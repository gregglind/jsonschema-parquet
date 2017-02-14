#!/usr/bin/env node
const VERSION = require('./package.json').version;
const path = require('path');
const deref = require('json-schema-deref');
/*
18:57 <@trink> https://github.com/mozilla-services/lua_sandbox_extensions/blob/master/parquet/io_modules/lpeg/parquet.lua#L139
18:59 <@trink> the do have docs on the nested type schemas https://github.com/apache/parquet-format/blob/master/LogicalTypes.md#nested-types
*/

// needs node6 because es6

/* the ideas

- read in some json schema
- publish it


Ps, people who are great at parsers and stuff could do this quickly.
I am not that people.

- https://github.com/mozilla-services/lua_sandbox_extensions/blob/master/parquet/io_modules/lpeg/parquet.lua#L128


from spark
>>> sch.simpleString()
'struct<a:bigint,b:struct<c:bigint>>'
>>> sch.jsonValue()
{'fields': [{'metadata': {}, 'type': 'long', 'name': 'a', 'nullable': True}, {'metadata': {}, 'type': {'fields': [{'metadata': {}, 'type': 'long', 'name': 'c', 'nullable': True}], 'type': 'struct'}, 'name': 'b', 'nullable': True}], 'type': 'struct'}
>>> sch = spark.read.json(sc.parallelize([{'a':1, 'b':{'c':1} }])).schema
>>> sch
StructType(List(StructField(a,LongType,true),StructField(b,StructType(List(StructField(c,LongType,true))),true)))

    message testpilot {
        required binary id;
        optional binary clientId;
        required group metadata {
            required int64  Timestamp;
            required binary submissionDate;
            optional binary Date;
            optional binary normalizedChannel;
            optional binary geoCountry;
            optional binary geoCity;
        }
        optional group application {
            optional binary name;
        }
        optional group environment {
            optional group system {
                optional group os {
                    optional binary name;
                    optional binary version;
                }
            }
        }
        optional group payload {
            optional binary version;
            optional binary test;
            repeated group events {
                optional int64  timestamp;
                optional binary event;
                optional binary object;
            }
        }
    }


from pyspark.sql.types import *
>>> s2 = MapType(StringType(), StringType())
>>> print json.dumps(s2.jsonValue(),indent=2)
{
  "keyType": "string",
  "type": "map",
  "valueType": "string",
  "valueContainsNull": true
}

>>> StructType().jsonValue()
{'fields': [], 'type': 'struct'}


https://irccloud.mozilla.com/pastebin/CB5mzQDw/

gregglind: https://github.com/apache/parquet-format/blob/master/LogicalTypes.md#maps for how a map schema should be defined

21:36 <@trink> an optional map appears to look like this
21:36 <@trink> https://irccloud.mozilla.com/pastebin/CB5mzQDw/

               https://github.com/fbertsch/schema_evolution_exploration/blob/master/Schema_Evolution_Exploration_use_col_names.ipynb


      optional group user_prefs (MAP) {
        repeated group map (MAP_KEY_VALUE) {
          required binary key (UTF8);
          required binary value (UTF8);
        }
      }

*/

class Parquet {
  constructor() {
    this.typemap = {
      "integer": "int64",
      "number": "float",

      "boolean": "boolean"
    };
  }
  convert (schema, options) {
    this.conversion = { type: 'message',
      name: schema.title || options.name,
      parts: this._convert(schema)
    };
    return this.conversion;
  }
  _convert (schema) {
    let partsArray = [];
    var that = this;
    Object.keys(schema.properties || {}).forEach(function convertProp(k) {
      let prop = schema.properties[k];
      if (prop.type === "object") {
        partsArray.push(that.convertGroup(k, schema));
      } else {
        partsArray.push(that.convertSingle(k, schema));
      }
    });
    return partsArray;
  }

  convertSingle(key, schema) {
    let prop = schema.properties[key];
    let type = this.typemap[prop.type] || "binary";
    return {
      type: type,
      required: (schema.required || []).includes(key),
      name: key
    };
  }
  convertGroup (key, schema) {
    let prop = schema.properties[key];
    let noProps = Object.keys(prop.properties || {}).length === 0;
    if (noProps && (prop.additionalProperties || {}).type) {
      return this._convertRepeatedGroup(key, schema);
    }

    return this._convertSimpleGroup(key, schema);
  }

  _convertSimpleGroup (key, schema) {
    let type = 'group'; // or group, etc.
    return {
      type: type,
      required: (schema.required || []).includes(key),
      name: key,
      parts: this._convert(schema.properties[key])
    };
  }
  _convertRepeatedGroup (key, schema) {
    /*
      required group attributes (MAP) {
          repeated group key_value {
              required binary key (UTF8) ;
              required binary value (UTF8) ;
          }
      }
    */
    let prop = schema.properties[key];
    let type = 'group'; // or group, etc.
    let noProps = Object.keys(prop.properties||{}).length === 0;
    if (!noProps) throw new Error("claims repeated, but it's not");

    return {
      repeated: true,
      type: type,
      required: (schema.required || []).includes(key),
      scheme: '(MAP_KEY_VALUE)',
      name: key,
      parts: [
        {
          required: true,
          name: 'key',
          type: 'binary'
        },
        {
          required: true,
          name: 'value',
          type: this.typemap[prop.additionalProperties.type] || "binary"
        },
      ]
    };
  }
  toString (digest) {
    if (digest===undefined) {
      digest = this.conversion;
    }
    function indent(spaces, times) {
      let spacer = Array(spaces).fill(" ").join('');
      return Array(times).fill(spacer).join('');
    }

    let out = [];
    let depth = 0;
    out.push([0, 'message', digest.name, '{']); // envelope
    out = out.concat(this._walk(digest, depth+1));
    out.push([0,'}']);  // envelope end
    let lines = out.map(function (lineArray) {
      let line =  indent(4,lineArray[0]) + lineArray.slice(1).join(" ");
      line = line.replace(/ +;/,';'); // no space before semi-colon;
      return line;
    });
    return lines.join('\n');
  }

  _walk (digest, depth=0) {
    //console.log(depth, digest.name);
    let that = this;
    let out = [];
    if (digest.parts) {
      digest.parts.forEach((p) => {
        if (p.type === 'group') {
          out = out.concat(that._writeGroup(p, depth));
        }
        else {
          out = out.concat(that._writeSingle(p, depth));
        }
      });
    }
    return out;
  }

  _writeSingle(part, depth) {
    let isRequired = part.required ?  'required' : 'optional';
    let out = [depth, isRequired, part.type, part.name];
    if (part.type === 'binary') out.push('(UTF8)');
    out.push(';');
    return [out];
  }

  _writeGroup(part, depth) {
    let isRequired = part.required ?  'required' : 'optional';
    let front = [depth, isRequired, 'group', part.name, '{'];
    if (part.scheme) {
      return this._writeMap(part, depth);
    }
    let middle = this._walk(part, depth+1);

    let end = [depth, '}'];
    return [].concat([front]).concat(middle).concat([end]);
  }
  _writeMap(part, depth) {
    /*
      required group attributes (MAP) {
          repeated group key_value {
              required binary key (UTF8) ;
              required binary value (UTF8) ;
          }
      }
    */
    let isRequired = part.required ?  'required' : 'optional';
    return [
      [depth, isRequired, 'group', part.name, '(MAP)', '{'],
      [depth+1, 'repeated', 'group', 'key_value', '{'],
      [depth+2, 'required', 'binary', 'key', '(UTF8)', ';'],
      [depth+2, 'required', 'binary', 'value', '(UTF8)', ';'],
      [depth+1,'}'],
      [depth, '}']
    ];
  }
}

function promiseDeref (schema) {
  return new Promise(function (resolve,reject) {
    deref(schema, function (err, fullSchema) {
      if (err) reject(err);
      resolve(fullSchema);
    });
  });
}

function runTests () {
  console.ok ('TESTS TODO');
}

var program = require('commander');

program
  .version(VERSION)
  .description('convert json schema to parquet-mr');

program
  .command('test')
  .action(function () {runTests();});


program
  .command('parquet <file> [otherFiles...]')
  .description('from jsonschema to parquet format')
  .option('--deref', 'Dereference all jsonschema $ref elements.')
  .action(function (file, otherFiles, options) {
    let toConvert = [file].concat(otherFiles);
    let P = new Parquet();
    let pr = Promise.resolve();

    function promiseConvert (f) {
      return new Promise(function (resolve, reject) {
        let schema = require(f);
        pr = Promise.resolve(schema);
        if (options.deref) {
          pr = pr.then(promiseDeref).catch(
            (err) => {console.error(`Dereference problem in: ${f}`, err);
            });
        }
        pr.then((schema) => {
          let conversion = P.convert(schema, {name: path.basename(f)});
          console.log(P.toString(conversion));
        }).then(resolve).catch(
            (err) => {console.error(`Conversion problem in: ${f}`, err);
            });
      });
    }
    toConvert.forEach((f) => {
      pr = pr.then(() => promiseConvert(f));
    });
    pr.catch((err) => {console.error(err);});
  });

if (require.main === module) {
    program.parse(process.argv);
}

exports.Parquet = Parquet;

