import { SCHEMA_ROOT_KEY } from "./index"
import { TypeConstructor } from './interfaces'

export const isObject = (value:any):boolean => {
  return (typeof value === 'object' && value !== null)
}

export const isFactoryKey = (obj:any):boolean => {
  if (!isObject(obj)) return false
  const props = Object.keys(obj)
  return (props.length === 1 || !!obj[SCHEMA_ROOT_KEY])
    && getTypeConstructor(props[0]) === String
}

export const isArrayKey = (obj:any):boolean => {
  if (!isObject(obj)) return false
  return Array.isArray(obj) && obj.length === 1
}

export const typeConsStrs: {[key:string]:string} = {
  [String.toString()]: 'string',
  [Number.toString()]: 'number',
  [Boolean.toString()]: 'boolean'
}

export const typeStrsCons:{[key:string]:TypeConstructor} = {
  'string':String,
  'String':String, 
  'number':Number, 
  'Number':Number, 
  'boolean':Boolean, 
  'Boolean':Boolean
}

// return typeof constructor
export function getTypeOfConstructor(typeCon:any):string {
  return typeConsStrs[typeCon]
}

export function getTypeConstructor(obj:any): (TypeConstructor | undefined) {

  if (obj === null || obj === undefined) return undefined

  // is obj a string?
  if (typeof obj === 'string') {
    // check if type is string or type-constructor as a string
    if (typeConsStrs[obj]) return typeStrsCons[typeConsStrs[obj]]
    else if (typeStrsCons[obj]) return typeStrsCons[obj]
  } else {
    // check if obj is type-constructor
    const keys = Object.keys(typeStrsCons)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const typeCon = typeStrsCons[key]
      if (typeCon === obj) return typeCon
    }
  }

  return undefined

}

export function isTypeConstructor(obj:any):boolean {
  return !!getTypeConstructor(obj)
}

export function isSchemaValue(obj:any):boolean {

  return obj !== null && obj !== undefined && (
    isTypeConstructor(obj) || // raw type
    (isObject(obj) && isTypeConstructor(obj.type)) // object with "type" property
  )

}