import { IPoint } from "influx"

/**
 * Timestamp mappings are used to source the "time" property to be sent to influx
 */
export interface TimestampMapping {
  type: "timestamp"
  /**
   * the name of the field to source this property from
   */
  from: string
  /**
   * default value, in case a result is missing this field
   */
  default?: string
  /**
   * parsing function to transform the string value of the time stamp, into a number measured in ms
   * @param value
   */
  transform: (value: string) => number
}

/**
 * Tag mappings are used to source the tags to associate with the point to be sent to influx
 */
export interface TagMapping {
  type: "tag"
  /**
   * the name of the field to source this property from
   */
  from: string
  /**
   * optional name to rename this field to when adding as a tag in influxdb
   */
  to?: string
  /**
   * default value, in case a result is missing this field
   */
  default?: string
  /**
   * optional parsing function to transform the value
   * @param value
   */
  transform?: (value: string) => string | void
}

/**
 * Field mappings are used to source the fields to be recorded on a point to be sent to influx
 */
export interface FieldMapping {
  type: "field",
  /**
   * the name of the field to source this property from
   */
  from: string
  /**
   * optional name to rename this field to when adding as a tag in influxdb
   */
  to?: string
  /**
   * default value, in case a result is missing this field
   */
  default?: string
  /**
   * parsing function to transform the string value of the field into the correct type
   * @param value
   */
  transform: (value: string) => number | string | boolean | void
}

export type Mapping = TimestampMapping | TagMapping | FieldMapping

export function mapToPointFactory(measurement: string, mappings: Mapping[]) {

  let timestamp: TimestampMapping
  let tags: TagMapping[] = []
  let fields: FieldMapping[] = []

  for (let mapping of mappings) {
    if (mapping.type === "timestamp") {

      if (timestamp!!) {
        throw new Error("cannot specify multiple timestamp mappings!")
      }

      if (!mapping.transform) {
        throw new Error("timestamp mapping must include a transform")
      }

      timestamp = mapping
    } else if (mapping.type === "tag") {
      tags.push(mapping)
    } else if (mapping.type === "field") {
      fields.push(mapping)
    }
  }

  return function mapToPoint(result: { [key: string]: string }): IPoint | undefined {
    const point = {
      measurement,
      timestamp: timestamp.transform(result[timestamp.from]),
      tags: mapValues(tags, result),
      fields: mapValues(fields, result),
    }

    if (Object.keys(point.fields).length < fields.length || Object.keys(point.tags).length < tags.length) {
      return undefined
    }

    return point
  }
}

export function mapValues(mappings: Mapping[], result: { [key: string]: string }): any {
  return mappings.reduce((acc, it) => {

    const value = result[it.from] || it.default

    if (!value) {
      return acc
    }

    const transformedValue = it.transform ? it.transform(value) : value

    if (!transformedValue) {
      return acc
    }

    let dest = ("to" in it && it.to) ? it.to : it.from

    acc[dest] = transformedValue

    return acc
  }, {} as any)
}
