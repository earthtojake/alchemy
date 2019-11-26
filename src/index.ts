import * as flat from 'flat'
import * as _ from 'lodash'
import { SchemaError, SCHEMA_ERRORS } from './error'
import { isObject, isSchemaValue, isFactoryKey, isTypeConstructor, typeStrsCons, getTypeConstructor, getTypeOfConstructor, isArrayKey } from './utils'
import { KeyPath, ValueReducer, Schema, Model, BaseSchema, SchemaValue, ValidateOptions, RawValue } from './interfaces'
import { createFirebaseMethods, firebaseProps, FirebaseMethods } from './firebase'

/*
schema rules:
can't use reserved keywords [__key, __value, __factory, __root__, ...methods] as prop in any node
leaf nodes need to be a valid schema value
*/

/*

reserved methods

keyPath()
parent()
validate()
cast()

TODO:
partialCast() => ignore optional fields in casted object
get(), set() => getter / setter for entire object

*/

// expose all types
export * from './interfaces'

export const SCHEMA_CHECK_KEY = '__this_is_a_schema__'
export const SCHEMA_ROOT_KEY = '__root__'
export const OBJECT_CHECK_KEY = '__this_is_schema_object__'
export const SCHEMA_FACTORY_KEY = '__factory'
export const SCHEMA_VALUE_KEY = '__value'
export const SCHEMA_KEY = '__key'

export const validateModel = (model: any, extraProps: {[key:string]:any} = {}, keyPath: KeyPath = []) => {

  if ((!isObject(model) || isSchemaValue(model)) && keyPath.length === 0) 
    throw new SchemaError(SCHEMA_ERRORS.INVALID_SCHEMA, `Schema must be an object, not a value`)  

  Object.keys(model).forEach((key:string) => {

    if (schemaProps[key]) {
      throw new SchemaError(SCHEMA_ERRORS.INVALID_SCHEMA, `Reserved method "${key}" used as key in schema, please rename this field.`, keyPath)
    }

    if (extraProps[key]) {
      throw new SchemaError(SCHEMA_ERRORS.INVALID_SCHEMA, `User-defined method "${key}" used as key in schema, please rename this method or field.`, keyPath)
    }

    let val = model[key]

    const validTypes = `[${Object.keys(typeStrsCons).map(s => `'${s}'`).join(', ')}]`

    if (isObject(val) && val.type) {
      // check val.type
      if (!isTypeConstructor(val.type) && !typeStrsCons[val.type]) {
        // "type" is incorrectly formatted
        throw new SchemaError(SCHEMA_ERRORS.INVALID_SCHEMA, `Invalid value ${val} for 'type' prop. THe keyword 'type' is a reserved in schemas and must be a type constructor [String, Boolean, Number] or type string ${validTypes}.`, keyPath)
      }
      // check keys
      Object.keys(val).forEach(prop => {
        if (!schemaValueProps[prop]) 
          throw new SchemaError(SCHEMA_ERRORS.INVALID_SCHEMA, `Invalid prop '${prop}' in schema value.`, keyPath)
      })
    } else if (!isSchemaValue(val) && isObject(val)) {
      // object
      validateModel(val, extraProps, keyPath.concat(key))
    } else if (!isSchemaValue(val)) {
      // not object or schema value, throw error
      throw new SchemaError(SCHEMA_ERRORS.INVALID_SCHEMA, `Invalid value ${val} in schema. Schema values must be a type constructor [String, Boolean, Number] or a type string ${validTypes} or objects which contain this type prop.`, keyPath)
    }

  })

}

const schemaValueProps: {[key:string]:boolean} = {
  type: true,
  typeof: true,
  default: true,
  required: true,
  max: true,
  min: true,
  lowercase: true,
  uppercase: true,
  trim: true,
  match: true,
  enum: true,
  minlength: true,
  maxlength: true,
  get: true,
  set: true,
}

const schemaProps: {[key:string]:boolean} = {
  validate: true,
  parent: true,
  cast: true,
  keyPath: true,
  set: true,
  get: true,
  ...firebaseProps
}

/* MODEL GENERATOR */
function schema<
  BaseType, 
  
>(
  model: Model<BaseType>,
  firebaseApp: firebase.app.App,
): Schema<BaseType> {

  // todo: ensure extra props do not clash with reserved props

  type ReservedProps = {[key:string]:boolean}

  const baseReservedProps: ReservedProps = {
    [SCHEMA_FACTORY_KEY]: true,
    __value: true,
    __key: true,
    ...schemaProps,
  }

  let schema = {} as BaseSchema<BaseType>

  function createHandler() {

    return {

      get: function(obj: any, prop: string) {

        // hidden props
        if (prop === SCHEMA_CHECK_KEY) return true

        const getPrevKeyPath = _.get(obj, ['keyPath'], () => [])

        // context from parent
        const factoryValue = obj[SCHEMA_FACTORY_KEY]
        const isFactory = !!factoryValue

        if (isFactory && prop === SCHEMA_FACTORY_KEY) return true

        // value
        let value = obj[prop]
        if (isFactory) value = factoryValue

        let isRoot = !!obj[SCHEMA_ROOT_KEY] && !isSchemaRoot(value)

        const isLeaf = !!obj.__value

        // reserved properties
        let reservedProps = baseReservedProps
        if (isLeaf) {
          reservedProps = {
            ...reservedProps,
            ...schemaValueProps
          }
        }

        // parse value
        if (isSchemaRoot(value)) {
          value = (<any>Object).assign({}, value)
          value.__key = prop
        }

        let schema: any = {}

        const keyPath = () => {
          if (isRoot) return []
          return getPrevKeyPath ? getPrevKeyPath().concat(prop) : [prop]
        }

        // reserved: validate, create, parent, get, set
    
        const props = {

          // validate object against schema
          validate: (obj: any) => validate(obj, schema), // inject schema into validator

          // get keyPath
          keyPath,

          // get parent node
          parent: () => {
            const root = this.__getRoot()
            const keyPath = getPrevKeyPath()
            if (keyPath.length === 0) return root
            else return _.get(root, keyPath)
          },

          cast: (obj: any) => cast(obj, schema),
    
          // firebase props
          ...createFirebaseMethods(schema, firebaseApp)
    
        }
    
        if (reservedProps[prop]) {

          schema = obj[prop]
          
        } else if (isSchemaValue(value)) {

          const rawType = !isTypeConstructor(value) ? value.type : value
          const type = getTypeConstructor(rawType)

          let valueFeatures = !isTypeConstructor(value) ? value : {}
          
          valueFeatures = {
            ...valueFeatures,
            type: type, // hardcode type
            typeof: getTypeOfConstructor(type), // inject typeof as string
          }
          
          // return getters for leaf values of schema
          if (!isSchema(value)) {
            schema = new Proxy({
              __value: true,
              __key: prop,
              ...valueFeatures,
              ...props
            }, createHandler())
            obj[prop] = schema
          } else {
            schema = value
          }
          
        } else if (isObject(value)) {
    
          // nested object
          if (isFactoryKey(value) || isArrayKey(value)) {
            
            // return node with child creator
            const factoryKey = Object.keys(value)[0]
            let child = value[factoryKey]

            // TODO: cache factory children
            schema = new Proxy({
              [SCHEMA_FACTORY_KEY]: child,
              __key: prop,
              ...props
            }, createHandler())

          } else {
    
            // return basic node
            if (!isSchema(value)) {
              schema = new Proxy({
                __key: prop,
                ...value,
                ...props
              }, createHandler())
              obj[prop] = schema
            } else {
              schema = value
            }
    
          }
    
        } else {

          schema = value
          
        }

        return schema

      },

      set: () => {
        // cannot set values
        throw new SchemaError(SCHEMA_ERRORS.SET, `Schemas are immutable. Do not attempt to set their properties`)
      },

      __getRoot: (): BaseSchema<BaseType> => {
        return schema
      }

    }

  }

  function reduceValues(obj: any, schema: any, reduceValue: ValueReducer<BaseType>) {

    const baseKeyPath = schema.keyPath()
  
    const _reduce = function(obj: any, schema: any, baseKeyPath: KeyPath = []) {
  
      if (!isObject(obj)) {
        return {
          [baseKeyPath.join('.')]: reduceValue(obj, schema, baseKeyPath)
        }
      }
  
      const keyPathsObj = flat.flatten(obj)
      let validatedKeyPaths: {[key:string]:any} = {}
  
      forEachValue(schema, (_1, val, isFactory) => {
  
        const keyPath = val.keyPath()
        const relKeyPath = keyPath.slice(baseKeyPath.length)
  
        if (isFactory) {
  
          const factorySchema = _.get(schema, relKeyPath)
  
          const objVals = (<any>Object).keys(keyPathsObj).reduce((objVals: {[key:string]: {val:any, keyPath:KeyPath}}, dotKeyPath: string) => {
            const keyPathArr = baseKeyPath.concat(dotKeyPath.split('.'))
            const factoryKeyPathArr = keyPathArr.splice(0, keyPath.length)
            if (factoryKeyPathArr.join('.') === keyPath.join('.')) {
              const factoryKey = keyPathArr[0]
              return {
                ...objVals,
                [factoryKey]: {
                  val: _.get(obj, factoryKeyPathArr.concat([factoryKey]).slice(baseKeyPath.length)),
                  keyPath: factoryKeyPathArr.concat([factoryKey])
                }
              }
            } else {
              return objVals
            }
          }, {})
  
          Object.keys(objVals).forEach(key => {
            validatedKeyPaths = {
              ...validatedKeyPaths,
              ..._reduce(objVals[key].val, factorySchema[key], objVals[key].keyPath)
            }
          })
  
        } else {
  
          const relKeyPath = keyPath.slice(baseKeyPath.length)
  
          const nestedSchema = _.get(schema, relKeyPath)
          const nestedVal = _.get(obj, relKeyPath)
  
          const fullKeyPath = baseKeyPath.concat(relKeyPath)
          validatedKeyPaths[fullKeyPath.join('.')] = reduceValue(nestedVal, nestedSchema, fullKeyPath)
  
        }
  
      })
  
      return validatedKeyPaths
  
    }
  
    // edge-case for single value
    if (!isObject(obj)) {
      return reduceValue(obj, schema as any, baseKeyPath)
    }
  
    // catch non-existant values in schema
    const objectKeyPaths:{[key:string]:any} = flat.flatten(obj)
    
    const _validatedKeyPaths = _reduce(obj, schema, baseKeyPath)
    const validatedKeyPaths:{[key:string]:any} = Object.keys(_validatedKeyPaths).reduce((keyPaths, keyPathKey) => {
      const relKeyPathKey = keyPathKey.split('.').slice(baseKeyPath.length).join('.')
      return {
        ...keyPaths,
        [relKeyPathKey]: _validatedKeyPaths[keyPathKey]
      }
    }, {})
  
    Object.keys(validatedKeyPaths).forEach(keyPathKey => {
      delete objectKeyPaths[keyPathKey]
    })
  
    Object.keys(objectKeyPaths).forEach(keyPath => {
      const val = objectKeyPaths[keyPath]
      const nestedSchema = _.get(schema, keyPath)
      validatedKeyPaths[keyPath] = reduceValue(val, nestedSchema, keyPath.split('.'))
    })
  
    return flat.unflatten(validatedKeyPaths)
  
  }
  
  function validate(obj: any, schema: Schema<BaseType>): BaseType {
    return reduceValues(obj, schema, validateValue)
  }
  
  const validateValue: ValueReducer<BaseType> = (value, schema: SchemaValue<BaseType>, keyPath, options: ValidateOptions = {}) => {

    const {
      ignoreRequired = false,
    } = options
  
    if (!schema) {
      throw new SchemaError(SCHEMA_ERRORS.INVALID_PATH, 'KeyPath does not exist in schema', keyPath)
    }
      
    let valStr = value ? `${value.toString()}` : 'undefined'
    if (typeof value === 'string') valStr = `'${valStr}'` 
  
    if (value) {
  
      if (schema.typeof !== typeof value) {
        const typeStr = typeof value
        throw new SchemaError(SCHEMA_ERRORS.TYPE, `Invalid type '${typeStr}' for value ${valStr}, should be type '${schema.typeof}'`, keyPath)
      }
  
      if (schema.type === Number) {
        
        if (schema.min !== undefined && value < schema.min)
          throw new SchemaError(SCHEMA_ERRORS.MIN, `Number ${valStr} less than minimum ${schema.min}`, keyPath)
        if (schema.max !== undefined && value > schema.max)
          throw new SchemaError(SCHEMA_ERRORS.MAX, `Number ${valStr} greater than maximum ${schema.max}`, keyPath)
      
      } else if (schema.type === String) {
  
        if (schema.maxlength !== undefined && value.length > schema.maxlength)
          throw new SchemaError(SCHEMA_ERRORS.MAXLENGTH, `String length of value ${valStr} greater than max length ${schema.maxlength}`, keyPath) 
  
        if (schema.minlength !== undefined && value.length < schema.minlength)
          throw new SchemaError(SCHEMA_ERRORS.MINLENGTH, `String length of value ${valStr} less than min length ${schema.minlength}`, keyPath) 

        if (schema.match && !schema.match.test(value))
          throw new SchemaError(SCHEMA_ERRORS.MATCH, `String ${valStr} does not match regular expression in schema`, keyPath)

      }

      if (schema.enum) {

        if (schema.enum.indexOf(value) === -1) {
          const enumStr = `[${schema.enum.join(', ')}]`
          throw new SchemaError(SCHEMA_ERRORS.ENUM, `String of value ${valStr} is not in the enum ${enumStr}`, keyPath) 
        }

      }
  
    } else {
  
      if (schema.required && !ignoreRequired) {
        throw new SchemaError(SCHEMA_ERRORS.REQUIRED, `Marked as required, got ${valStr}`, keyPath)
      }
  
    }
  
    return value
  
  }
  
  function cast(obj: any, schema: any) {

    type CreateContext = {
      proxies: {
        [keyPathKey:string]: {
          get: (val:any) => any,
          set: (val:any) => any
        }
      }
    }
    
    const ctx: CreateContext = {
      proxies: {}
    }

    // validate original object
    validate(obj, schema)

    // coerce object values
    const coercedObj = reduceValues(obj, schema, coerceValue)

    // validate full, coerced object
    validate(coercedObj, schema)

    const proxify = (coercedObj: any) => {

      function getNodeList(o: any, baseKeyPath: KeyPath = []): {[key:string]:any} {
        
        let keyPaths:{[key:string]:any} = {}

        if (baseKeyPath.length > 0) keyPaths[baseKeyPath.join('.')] = o

        if (!o || !isObject(o)) return keyPaths

        const _o = o as {[key:string]:any}

        Object.keys(_o).forEach((key:string) => {
          const keyPath = baseKeyPath.concat([key])
          const keyPathKey = keyPath.join('.')
          keyPaths[keyPathKey] = _o[key]
          if (isObject(_o[key])) {
            keyPaths = {
              ...keyPaths,
              ...getNodeList(_o[key], keyPath)
            }
          }
        })

        return keyPaths

      }

      const nodes = getNodeList(coercedObj)

      const createSchemaObject = (value:any, schema:any, keyPathKey:string = '') => {

        return isObject(value) ? new Proxy(value, {

          get: (obj: any, prop: string) => {

            if (prop === '__get_object_schema__') {
              return keyPathKey ? _.get(schema, keyPathKey) : schema
            }

            if (prop === OBJECT_CHECK_KEY) return true

            // inject custom getter
            const customGet = _.get(ctx.proxies, keyPathKey ? [keyPathKey, prop, 'get'] : [prop, 'get'])
            if (customGet) {
              return customGet(obj[prop])
            }

            return obj[prop]

          },

          set: (obj:any, prop:string, _value:any) => {

            let value = _value

            const baseKeyPathKey = keyPathKey ? keyPathKey + '.' + prop : prop

            // validate new value
            const baseKeyPath = baseKeyPathKey.split('.')
            const nestedSchema = _.get(schema, baseKeyPath)
            validate(value, nestedSchema)

            const parentSchema = nestedSchema.parent()

            obj[prop] = value
            const parentNode = cast(obj, parentSchema)
            obj[prop] = parentNode[prop]

            return true

          }

        }) : value

      }

      Object.keys(nodes).reverse().forEach(keyPathKey => {
        
        const value = nodes[keyPathKey]

        const node = createSchemaObject(value, schema, keyPathKey)

        _.set(coercedObj, keyPathKey, node)

      })

      return createSchemaObject(coercedObj, schema)

    }

    function coerceValue(_value: any, schema: any, keyPath: KeyPath): RawValue {
  
      // called validate
    
      let value = _value

      if (schema[SCHEMA_FACTORY_KEY]) {
        // skip coercing
        return value
      }
    
      if (schema.default && !value) {
        value = schema.default
      }
  
      if (schema.type === String) {
  
        const valStr = value as string
  
        if (schema.lowercase) {
          value = valStr.toLowerCase()
        }
  
        if (schema.uppercase) {
          value = valStr.toUpperCase()
        }
  
        if (schema.trim) {
          value = valStr.trim()
        }
  
      }
    
      if (value && schema.get) {
        // create ref for getter to inject into proxy
        _.set(ctx.proxies, [keyPath.join('.'), 'get'], schema.get)
      }
  
      if (value && schema.set) {
        // apply setter to value on creation
        value = schema.set(value)
      }
    
      return value
    
    }

    return !isObject(coercedObj) ? coercedObj :proxify(coercedObj)

  }

  // validates inputted model for vanilla js (non-typed)
  validateModel(model)

  let proxy:any = new Proxy({
    [SCHEMA_ROOT_KEY]: {
      ...model,
    },
  }, createHandler());

  schema = proxy[SCHEMA_ROOT_KEY]

  return schema as BaseSchema<BaseType>

}

function isEmpty(obj: any) {
  if (!obj) return true // no-value
  else if (isObject(obj)) return Object.keys(obj).length === 0 // check for empty object / array
  else return !obj // check for empty value
}

function forEachValue(obj: any, callback: (key: string | number, obj: any, isFactory?: boolean) => void) {

  Object.keys(obj).forEach(key => {

    let val = obj[key]

    if (!val) return

    if (typeof val === 'function') return
    else if (val.__value || val[SCHEMA_FACTORY_KEY]) callback(key, val, !!val[SCHEMA_FACTORY_KEY])
    else if (isObject(val) && !isEmpty(obj)) forEachValue(val, callback)

  })

}

/* HELPER FUNCTIONS */
export const isSchema = (obj:any):boolean => {
  return obj != null && (!!obj[SCHEMA_CHECK_KEY] || isSchemaRoot(obj))
}

export const isSchemaRoot = (obj:any):boolean => {
  return obj != null && obj.__key === SCHEMA_ROOT_KEY
}

export const isSchemaEqual = (schemaA:any, schemaB:any):boolean => {

  return isSchema(schemaA) && isSchema(schemaB) && 
    schemaA.__key === schemaB.__key && 
    _.isEqual(Object.keys(schemaA), Object.keys(schemaB))

}

export const getSchema = (obj:any):boolean => {
  return obj.__get_object_schema__
}

export default schema