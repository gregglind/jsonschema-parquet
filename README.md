# jsonschema-parquet

Convert between JSONSchema and Parquet-MR formats

## Usage


Command line (CLI)

`$ jsonchema-parquet parquet --deref ~/gits/mozilla-pipeline-schemas/telemetry/*`

Library / Require

```
// I am not happy with this, and will be fixing it VERY SOON.

> let { Parquet } = require("jsonschema-parquet")
> p = new Parquet();
> c = p.convert({title: 'a schema', properties: {a: {type:"integer"}}})
{ type: 'message',
  name: 'a schema',
  parts: [ { type: 'int64', required: false, name: 'a' } ] }

> console.log(p.toString(c))
message a schema {
    optional int64 a;
}
```


## Horrible details / Opinions / Translation Strategy

### Key Value Maps


## Incomplete Sections / Wanting Fixes

- Arrays
- Other types
- conversion from parquet to JSONSchema
- more flags for allowing titles, etc from the cli



## References

- [Parquet Format](https://github.com/apache/parquet-format/blob/master/LogicalTypes.md)
- [JSONSchema](http://jsonschema.net/#/)
