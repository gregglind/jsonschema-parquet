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

*/


class Result {
  constructor(result) {
    this.json = result;
  }
  toJSON () {
    return JSON.stringify(this.json);
  }
  toString () {
    throw new Error('to String is not yet complete');
  }
}

class Converter {
  _convert (section) {
    switch (section(['type'])) {
      case "object":
        return this.fromObject(section)
        break;
      case "string":
        return this.fromString(section);
        break
      case "integer":
        return this.fromInteger(section);
        break;
      default:
        throw new Error("unimplemented typo, todo");
        break
    }
  }
  fromObject (section) {
    // struct or map maybe?  try struct first
    let props = Object.keys(section(['properties']));
    if (props.length) {
      // Yes a struct
    }
  }

  fromString (section) {

  }

  fromInteger (section) {

  }

  convert (jsonschema) {
    return new Result({'a': 1});
  }
}


exports.Converter = Converter;
let R = new Converter().convert(require("./examples.json").common).toJSON();
console.log(R);


