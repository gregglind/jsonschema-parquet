// needs node6 because es6

/* the ideas

- read in some json schema
- publish it


Ps, people who are great at parsers and stuff could do this quickly.
I am not that people.

15:58 < gregglind> trink: tell me more about jsonschema to parquet conversion.  I am going to do it in JS fro jsonschema to parquet.  Is that a tool that's worth turning into a Tool
16:00 < gregglind> I also don't know what the final format should be :)
16:05 <@trink> JS probably won't be ideal for the automated conversion of the schema repo
16:08 < gregglind> okay, gimme another options :)
16:08 <@trink> the parquet schema is what parquet-mr defines the formal grammar can be found here
               https://github.com/mozilla-services/lua_sandbox_extensions/blob/master/parquet/io_modules/lpeg/parquet.lua#L128
16:08 -!- mpressman [textual@moz-iubvlc.6gmu.psfh.0282.2601.IP] has quit [RecvQ exceeded]
16:09 <@trink> or I can get you a link to the parquet-mr java parsing code
16:09 < gregglind> As far at output format, spark gives js, string, other things for what it can turn 'schema' into.



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


*/


class Result {
  constructor(result) {
    this.json = result;
  }
  toJSON () {
    return this.json;
  }
  toString () {
    throw new Error('to String is not yet complete');
  }
}

class Converter {
  _convert (section) {
    //console.log(section);
    switch (section.type) {
      case "object":
        return this.fromObject(section)
        break;
      case "string":
        return this.fromString(section, nullable);
        break
      case "integer":
        return this.fromInteger(section, nullable);
        break;
      default:
        throw new Error("unimplemented type, todo");
        break
    }
  }
  fromObject (section, name) {
    // struct or map maybe?  try struct first
    let props = Object.keys(section['properties']);
    let additionalProperties = section.additionalProperties || {};
    // https://spacetelescope.github.io/understanding-json-schema/reference/object.html

    // break early and do simple maps
    switch (additionalProperties.type) {
      case 'string':
      case 'integer':
        return this.toMap("string", additionalProperties.type, name);

      case null:
      case undefined:
        break;

      default:
        throw new Error('map, but on an unknown type: ' + additionalProperties.type)
        break;
    }

    return this.toStruct(section, name);
  }

  fromSimple (name, prop, nullable) {
    return {
      'metadata': {},
      'type': prop.type,
      'name': name,
      'nullable': nullable
    }
  }

  fromString (section) {
    return
  }

  fromInteger (section) {
    return
  }

  toStruct(section, name) {
    let that = this;
    let out = {type: 'struct'};
    if (name) {
      out.name = name;
    }
    let props = Object.keys(section['properties']) || [];

    let required = section.required || [];
    out.fields = props.map(function (f) {
      let prop = section.properties[f];
      let propType = prop.type;
      switch (propType) {
        case 'object':
          //console.log("RECURIVE OBJECTS ARE WIP");
          //console.log(prop);
          return that.fromObject(prop, name=f);
      }
      return that.fromSimple(f, prop, section.required.includes(prop.name))
    });
    return out;

  }
  toStructField(section) {

  }
  toMap(keytype, valuetype, name) {
    /* TODO: this isn't fully finished.*/
    return {
      "keyType": keytype,
      "type": "map",
      "valueType": valuetype,
      "valueContainsNull": true,
      "name": name
    }
  }
  convert (jsonschema) {
    return new Result(this._convert(jsonschema));
  }
}

exports.Converter = Converter;
let J = new Converter();
let x = require('./examples.json');
console.log("COMMON");
console.log(JSON.stringify(J.convert(x.common).toJSON(),null,2))
console.log("SHIELD-STUDY-DATA");

console.log(JSON.stringify(J.convert(x["shield-study-data"]).toJSON(),null,2))
console.log("SHIELD-STUDY-ADDON-DATA");

console.log(JSON.stringify(J.convert(x["shield-study-addon-data"]).toJSON(),null,2))
console.log("SHIELD-STUDY-ERROR-DATA");

console.log(JSON.stringify(J.convert(x["shield-study-error-data"]).toJSON(),null,2))
console.log("SIMPLE");

console.log(JSON.stringify(J.convert(x.simple).toJSON(),null,2))
console.log("aMAP");

console.log(JSON.stringify(J.convert(x.aMap).toJSON(),null,2))
