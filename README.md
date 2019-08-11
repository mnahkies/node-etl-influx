# etl-influx
[![npm](https://img.shields.io/npm/v/etl-influx.svg)](https://www.npmjs.com/package/etl-influx)

This is a node module that provides some functions to help easily etl data from different data sources into influxdb.
Currently etl from csv file, and from splunk is supported. Other sources such as elastic search may be added
in future.

## Installation

```shell script
$ npm install --save etl-influx
```

## Usage

### Query and Mapping API
Please see the source for jsdoc style comments describing the query and mapping interfaces 

[a src/ingesters/map-to-point.ts](src/ingesters/map-to-point.ts)  
[a src/ingesters/ingester.ts](src/ingesters/ingester.ts)  

### Monitoring progress
Basic progress events are emitted by each ingester. The CSV ingester will emit one event every 10000 lines processed, and the splunk ingester after each time slice has been processed.

### Clean Up / Destroying ingesters
After you are finished with an ingester, it is reccomended that you destroy it by calling the `destroy()` method.
This is to clean up intervals that are used to batch point submissions to influxdb.

### CSV File Ingester
Given a CSV file with a format like:

```csv
timestamp,service,route,result,elapsed
"2019-08-08T15:51:53.175+0000","my-service","some/api/endpoint",200,14
"2019-08-08T15:51:52.145+0000","my-service","some/api/endpoint",200,24
```

You can ETL to influxdb like so. Note that the mapping `from` fields should correspond to column names defined
on the first line of the file.

The parseLine function is required to allow you to specify the field delimiter, and optionally clean up the data 
(eg: remove quotes as in example)

```javascript
import {CsvIngester} from "etl-influx"

const config = {
    influx: {
      "host": "localhost",
      "protocol": "http",
      "username": "root",
      "password": "root",
      "database": "test"
    }
}

const query = {
    filename: "./data/1565279533_36391.csv",
    parseLine: line => line.split(",").map(it => it.replace(/"/g, "")),
    measurement: "request_durations",
    mappings: [
        { type: "timestamp", from: "_time", transform: value => moment(value).valueOf() },
        { type: "tag", from: "service", to: "service_name", default: "unknown" },
        { type: "tag", from: "route", to: "operation_name", default: "unknown" },
        { type: "tag", from: "result", to: "status_code", default: "unknown" },
        { type: "field", from: "elapsed", to: "duration", transform: value => parseInt(value, 10) },
    ],
}

(await CsvIngester.create(config))
        .onProgress(({totalPoints}) => console.log(`processed ${totalPoints} so far`))
        .ingest(query)
```

### Splunk Historic Rest Ingester
You can ETL data out of splunk using it's rest api. Note that this is implemented via series of searches using
a time range based on the stepSize duration parameter.

The mappings provided are parsed into a `| table col1, col2, col3` statement which is appended to the provided query, 
where col1, etc is sourced from the `from` property.

```javascript
import {SplunkHistoricRestIngester} from "etl-influx"

const config = {
    influx: {
      "host": "localhost",
      "protocol": "http",
      "username": "root",
      "password": "root",
      "database": "test"
    },
    splunk: {
      "host": "localhost",
      "username": "admin",
      "password": "admin"
    }
}
const query = {
    from: moment().subtract(1, "day").startOf("day"),
    to: moment(),
    stepSize: moment.duration(1, "hour"),

    query: `index=* message="request complete" elapsed != null`,

    measurement: "request_durations",
    mappings: [
            { type: "timestamp", from: "_time", transform: value => moment(value).valueOf() },
            { type: "tag", from: "service", to: "service_name", default: "unknown" },
            { type: "tag", from: "route", to: "operation_name", default: "unknown" },
            { type: "tag", from: "result", to: "status_code", default: "unknown" },
            { type: "field", from: "elapsed", to: "duration", transform: value => parseInt(value, 10) },
    ],
}

(await SplunkHistoricRestIngester.create(config))
    .onProgress(({totalPoints}) => console.log(`processed ${totalPoints} so far`))
    .ingest(query)
```

# Future Plans (contributions welcome)

- Enhance progress reporting

- A real time splunk ingester (I have one written, but untested due to insufficient permissions 
  on the splunk instance I'm testing against)
  
- A elastic search ingester

- Add unit tests
