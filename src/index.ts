import * as flat from 'flat'
import * as _ from 'lodash'

/* TYPES */
declare interface ProxyHandler<T> {}
interface ProxyConstructor {
  revocable<T extends object>(target: T, handler: ProxyHandler<T>): { proxy: T; revoke: () => void; };
  new <T extends object>(target: T, handler: ProxyHandler<T>): T;
}
declare var Proxy: ProxyConstructor;

type Path = Array<string>

type ValueReducer<BaseType,ExtraProps> = (value: any, schema: SchemaValue<BaseType,ExtraProps>, path: Path, options?: object) => any

type ValidateOptions = {
  ignoreRequired?: boolean,
}

type Validate<BaseType = {}> = (obj: any, options?: ValidateOptions) => BaseType

type GetParent = () => any

type Create<BaseType = {}> = (obj: any) => BaseType

type GetPath = () => Path

type SchemaProps<BaseType = {}, ExtraProps = {}> = {
  __key: string,
  __value?: boolean,
  __factory?: any,
  __root?: boolean,
  props: {
    validate: Validate<BaseType>,
    parent: GetParent,
    create: Create<BaseType>,
    path: GetPath,
  } & ExtraProps 
}

export type Props<ExtraProps = {}> = {
  validate: Validate,
  parent: GetParent,
  create: Create,
  path: GetPath,
} & ExtraProps

// strings, booleans, numbers only
type RawValue = string | number | boolean
type TypeConstructor = StringConstructor | BooleanConstructor | NumberConstructor
type TypeString = 'string' | 'String' | 'boolean' | 'Boolean' | 'number' | 'Number'

type SchemaValueOptions = {
  default?: any,
  required?: boolean,
  max?: number,
  min?: number,
  lowercase?: boolean,
  uppercase?: boolean,
  trim?: boolean,
  match?: RegExp,
  enum?: Array<any>,
  minlength?: number,
  maxlength?: number,
  get?: (val: any) => any,
  set?: (val: any) => any,
}

type SchemaValue<BaseType = {}, ExtraProps = {}> = {
  type: TypeConstructor
  typeof: TypeString,
} & SchemaValueOptions & SchemaProps<BaseType, ExtraProps>

type ModelValue = TypeConstructor | TypeString | {
  type: TypeConstructor | TypeString,
} & SchemaValueOptions

export type Model<BaseType> = {
  [K in keyof BaseType]:
    BaseType[K] extends ModelValue ? ModelValue :
    BaseType[K] extends Schema<BaseType> ? Schema<BaseType[K]> :
    BaseType[K] extends object ? Model<BaseType[K]> :
    ModelValue;
}

export type Schema<BaseType = {}, ExtraProps = {}> = {
  [K in keyof BaseType]:
    BaseType[K] extends object ? Schema<BaseType[K], ExtraProps>:
    SchemaValue<BaseType[K], ExtraProps>;
} & SchemaProps<BaseType, ExtraProps>

/* HELPER FUNCTIONS */
const isObject = (value:any):boolean => {
  return (typeof value === 'object' && value !== null)
}

const isFactoryKey = (obj:any):boolean => {
  if (!isObject(obj)) return false
  const props = Object.keys(obj)
  return (props.length === 1 || !!obj.__root)
    && getTypeConstructor(props[0]) === String
}

const isArrayKey = (obj:any):boolean => {
  if (!isObject(obj)) return false
  return Array.isArray(obj) && obj.length === 1
}

const typeConsStrs: {[key:string]:string} = {
  [String.toString()]: 'string',
  [Number.toString()]: 'number',
  [Boolean.toString()]: 'boolean'
}

const typeStrsCons:{[key:string]:TypeConstructor} = {
  'string':String,
  'String':String, 
  'number':Number, 
  'Number':Number, 
  'boolean':Boolean, 
  'Boolean':Boolean
}

// return typeof constructor
function getTypeOfConstructor(typeCon:any):string {
  return typeConsStrs[typeCon]
}

function getTypeConstructor(obj:any): (TypeConstructor | undefined) {

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

function isTypeConstructor(obj:any):boolean {
  return !!getTypeConstructor(obj)
}

function isSchemaValue(obj:any):boolean {

  return obj !== null && obj !== undefined && (
    isTypeConstructor(obj) || // raw type
    (isObject(obj) && isTypeConstructor(obj.type)) // object with "type" property
  )

}

export const SCHEMA_ERRORS = {
  INVALID_SCHEMA: 'SchemaError',
  INVALID_PATH: 'SchemaPathError',
  TYPE: 'SchemaTypeError',
  REQUIRED: 'SchemaRequiredError',
  MAX: 'SchemaMaxError',
  MIN: 'SchemaMinError',
  MATCH: 'SchemaMatchError',
  ENUM: 'SchemaEnumError',
  MINLENGTH: 'SchemaMinlengthError',
  MAXLENGTH: 'SchemaMaxlengthError',
}

class SchemaError extends Error {
  constructor(name: string, message = "", path?: Path) {
    super(message);
    let preMsg = `Schema violation`
    if (path) {
      const pathStr = `[${path.join(', ')}]`
      preMsg += ` at ${pathStr}`
    }
    this.name = name
    this.message = `${preMsg}, ${message}`;
  }
}

const defaultSchemaValue = {
  type: undefined,
  typeof: undefined,
  default: undefined,
  required: undefined,
  max: undefined,
  min: undefined,
  lowercase: undefined,
  uppercase: undefined,
  trim: undefined,
  match: undefined,
  enum: undefined,
  minlength: undefined,
  maxlength: undefined,
  get: undefined,
  set: undefined,
}

/* MODEL GENERATOR */
function NewSchema<
  BaseType = any, 
  ExtraProps = object
>(
  model: Model<BaseType>,
  extraProps?: ExtraProps
): Schema<BaseType, ExtraProps> {

  // todo: ensure extra props do not clash with reserved props

  type ReservedProps = {[key:string]:boolean}

  const baseReservedProps: ReservedProps = {
    props: true,
    __factory: true,
    __value: true,
    __key: true,
  }

  let schema = {} as Schema<BaseType, ExtraProps>

  const _extraProps = (extraProps||{}) as {[key:string]:any}

  const handler = {

    get: function(obj: any, prop: string) {

      if (prop === '__this_is_a_schema__') return true

      // context from parent
      const factoryValue = obj.__factory
      const isFactory = !!factoryValue

      if (isFactory && prop === '__factory') return true

      // value
      let value = obj[prop]
      if (isFactory) value = factoryValue

      let isRoot = !!obj.__root && !isSchemaRoot(value)

      const isLeaf = !!obj.__value

      // reserved properties
      let reservedProps = baseReservedProps
      if (isLeaf) {
        reservedProps = {
          ...reservedProps,
          ...(<any>Object).keys(defaultSchemaValue).reduce((obj:ReservedProps, key:string) => {
            obj[key] = true
            return obj
          }, {}),
        }
      }

      // parse value
      if (isSchemaRoot(value)) {
        value = (<any>Object).assign({}, value)
        value.__key = prop
      }

      let schema: any = undefined

      const getPrevPath = _.get(obj, ['props', 'path'], () => [])
      const path = () => {
        if (isRoot) return []
        return getPrevPath ? getPrevPath().concat(prop) : [prop]
      }
  
      const props = {

        // validate object against schema
        validate: (obj: any) => validate(obj, schema), // inject schema into validator

        // get path
        path,

        // get parent node
        parent: () => {
          const root = this.__getRoot()
          const path = getPrevPath()
          if (path.length === 0) return root
          else return _.get(root, path)
        },

        create: (obj: any) => create(obj, schema),
  
        // extra props
        ...(<any>Object).keys(_extraProps).reduce((obj: object, key: string) => {

          return {
            ...obj,
            [key]: _extraProps[key].bind(schema)
          }
  
        }, {})
  
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
        schema = new Proxy({
          __value: true,
          __key: prop,
          ...valueFeatures,
          props
        }, handler)
        
      } else if (isObject(value)) {
  
        // nested object
        if (isFactoryKey(value) || isArrayKey(value)) {
          
          // return node with child creator
          const factoryKey = Object.keys(value)[0]
          const child = value[factoryKey]

          schema = new Proxy({
            __factory: child,
            __key: prop,
            props
          }, handler)
    
        } else {
  
          // return basic node
          schema = new Proxy({
            __key: prop,
            ...value,
            props
          }, handler)
  
        }
  
      } else {

        // immediately return true value
        schema = value
        
      }

      return schema

    },

    set: () => {
      // cannot set values
      throw Error(`Schema vioaltion: Schemas are immutable. Do not attempt to set their properties`)
    },

    __getRoot: (): Schema<BaseType, ExtraProps> => {
      return schema
    }

  }

  function reduceValues(obj: any, schema: any, reduceValue: ValueReducer<BaseType, ExtraProps>) {

    const basePath = schema.props.path()
  
    const _reduce = function(obj: any, schema: any, basePath: Path = []) {
  
      if (!isObject(obj)) {
        return {
          [basePath.join('.')]: reduceValue(obj, schema, basePath)
        }
      }
  
      const pathsObj = flat.flatten(obj)
      let validatedPaths: {[key:string]:any} = {}
  
      forEachValue(schema, (_1, val, isFactory) => {
  
        const path = val.props.path()
        const relPath = path.slice(basePath.length)
  
        if (isFactory) {
  
          const factorySchema = _.get(schema, relPath)
  
          const objVals = (<any>Object).keys(pathsObj).reduce((objVals: {[key:string]: {val:any, path:Path}}, dotPath: string) => {
            const pathArr = basePath.concat(dotPath.split('.'))
            const factoryPathArr = pathArr.splice(0, path.length)
            if (factoryPathArr.join('.') === path.join('.')) {
              const factoryKey = pathArr[0]
              return {
                ...objVals,
                [factoryKey]: {
                  val: _.get(obj, factoryPathArr.concat([factoryKey]).slice(basePath.length)),
                  path: factoryPathArr.concat([factoryKey])
                }
              }
            } else {
              return objVals
            }
          }, {})
  
          Object.keys(objVals).forEach(key => {
            validatedPaths = {
              ...validatedPaths,
              ..._reduce(objVals[key].val, factorySchema[key], objVals[key].path)
            }
          })
  
        } else {
  
          const relPath = path.slice(basePath.length)
  
          const nestedSchema = _.get(schema, relPath)
          const nestedVal = _.get(obj, relPath)
  
          const fullPath = basePath.concat(relPath)
          validatedPaths[fullPath.join('.')] = reduceValue(nestedVal, nestedSchema, fullPath)
          // console.log(fullPath, nestedVal)
  
        }
  
      })
  
      return validatedPaths
  
    }
  
    // edge-case for single value
    if (!isObject(obj)) {
      return reduceValue(obj, schema as any, basePath)
    }
  
    // catch non-existant values in schema
    const objectPaths:{[key:string]:any} = flat.flatten(obj)
    
    const _validatedPaths = _reduce(obj, schema, basePath)
    const validatedPaths:{[key:string]:any} = Object.keys(_validatedPaths).reduce((paths, pathKey) => {
      const relPathKey = pathKey.split('.').slice(basePath.length).join('.')
      return {
        ...paths,
        [relPathKey]: _validatedPaths[pathKey]
      }
    }, {})
  
    Object.keys(validatedPaths).forEach(pathKey => {
      delete objectPaths[pathKey]
    })
  
    Object.keys(objectPaths).forEach(path => {
      const val = objectPaths[path]
      const nestedSchema = _.get(schema, path)
      validatedPaths[path] = reduceValue(val, nestedSchema, path.split('.'))
    })
  
    return flat.unflatten(validatedPaths)
  
  }
  
  function validate(obj: any, schema: Schema<BaseType,ExtraProps>): BaseType {
    return reduceValues(obj, schema, validateValue)
  }
  
  const validateValue: ValueReducer<BaseType,ExtraProps> = (value, schema: SchemaValue<BaseType,ExtraProps>, path, options: ValidateOptions = {}) => {

    const {
      ignoreRequired = false,
    } = options
  
    if (!schema) {
      throw new SchemaError(SCHEMA_ERRORS.INVALID_PATH, 'Path does not exist in schema', path)
    }
      
    const pathStr = `[${path.join(', ')}]`
    let valStr = value ? `${value.toString()}` : 'undefined'
    if (typeof value === 'string') valStr = `'${valStr}'` 
  
    if (value) {
  
      if (schema.typeof !== typeof value) {
        const typeStr = typeof value
        throw new SchemaError(SCHEMA_ERRORS.TYPE, `Invalid type '${typeStr}' for value ${valStr}, should be type '${schema.typeof}'`, path)
      }
  
      if (schema.type === Number) {
        
        if (schema.min !== undefined && value < schema.min)
          throw new SchemaError(SCHEMA_ERRORS.MIN, `Number ${valStr} less than minimum ${schema.min}`, path)
        if (schema.max !== undefined && value > schema.max)
          throw new SchemaError(SCHEMA_ERRORS.MAX, `Number ${valStr} greater than maximum ${schema.max}`, path)
      
      } else if (schema.type === String) {
  
        if (schema.maxlength !== undefined && value.length > schema.maxlength)
          throw new SchemaError(SCHEMA_ERRORS.MAXLENGTH, `String length of value ${valStr} greater than max length ${schema.maxlength}`, path) 
  
        if (schema.minlength !== undefined && value.length < schema.minlength)
          throw new SchemaError(SCHEMA_ERRORS.MINLENGTH, `String length of value ${valStr} less than min length ${schema.minlength}`, path) 

        if (schema.match && !schema.match.test(value))
          throw new SchemaError(SCHEMA_ERRORS.MATCH, `String ${valStr} does not match regular expression in schema`, path)

      }

      if (schema.enum) {

        if (schema.enum.indexOf(value) === -1) {
          const enumStr = `[${schema.enum.join(', ')}]`
          throw new SchemaError(SCHEMA_ERRORS.ENUM, `String of value ${valStr} is not in the enum ${enumStr}`, path) 
        }

      }
  
    } else {
  
      if (schema.required && !ignoreRequired) {
        throw new SchemaError(SCHEMA_ERRORS.REQUIRED, `Marked as required, got ${valStr}`, path)
      }
  
    }
  
    return value
  
  }
  
  function create(obj: any, schema: any) {

    if (!isObject(obj)) {
      return coerceValue(obj, schema, schema.props.path())
    }

    type CreateContext = {
      proxies: {
        [pathKey:string]: {
          [prop:string]: {
            get: (val:RawValue) => RawValue,
            set: (val:RawValue) => RawValue
          }
        }
      }
    }
    
    const ctx: CreateContext = {
      proxies: {}
    }

    // coerce object values
    const coercedObj = reduceValues(obj, schema, coerceValue)

    // validate full, coerced object
    validate(coercedObj, schema)

    const proxify = (coercedObj: any) => {

      function getNodeList(o: any, basePath: Path = []): {[key:string]:any} {
        
        let paths:{[key:string]:any} = {}

        if (basePath.length > 0) paths[basePath.join('.')] = o

        if (!o || !isObject(o)) return paths

        const _o = o as {[key:string]:any}

        Object.keys(_o).forEach((key:string) => {
          const path = basePath.concat([key])
          const pathKey = path.join('.')
          paths[pathKey] = _o[key]
          if (isObject(_o[key])) {
            paths = {
              ...paths,
              ...getNodeList(_o[key], path)
            }
          }
        })

        return paths

      }

      const nodes = getNodeList(coercedObj)

      Object.keys(nodes).reverse().forEach(pathKey => {
        
        const value = nodes[pathKey]

        const node = isObject(value) ? new Proxy(value, {

          get: (obj: any, prop: string) => {

            if (prop === '__get_object_schema__') {
              return _.get(schema, pathKey)
            }

            // inject custom getter
            const customGet = _.get(ctx.proxies, [pathKey, prop, 'get'])
            if (customGet) {
              return customGet(obj[prop])
            }

            return obj[prop]

          },

          set: (obj:any, prop:string, _value:any) => {

            let value = _value

            const basePathKey = pathKey ? pathKey + '.' + prop : prop

            // validate new value
            const basePath = basePathKey.split('.')
            const nestedSchema = _.get(schema, basePath)
            validate(value, nestedSchema)

            const parentSchema = nestedSchema.props.parent()

            obj[prop] = value
            const parentNode = create(obj, parentSchema)
            obj[prop] = parentNode[prop]

            return true

          }

        }) : value

        _.set(coercedObj, pathKey, node)

      })

      return coercedObj

    }

    function coerceValue(_value: any, schema: SchemaValue<BaseType, ExtraProps>, path: Path) {
  
      // called validate
    
      let value = _value

      if (schema.__factory) {
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
  
      const parentPathKey = path.slice(0,path.length-1).join('.')
      const prop = path[path.length-1]
    
      if (value && schema.get) {
        // create ref for getter to inject into proxy
        _.set(ctx.proxies, [parentPathKey, prop, 'get'], schema.get)
      }
  
      if (value && schema.set) {
        // apply setter to value on creation
        value = schema.set(value)
      }
    
      return value
    
    }

    return proxify(coercedObj)

  }

  let {__root}:any = new Proxy({
    __root: {
      ...model,
    },
  }, handler);

  schema = __root

  return schema as Schema<BaseType, ExtraProps>

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
    else if (val.__value || val.__factory) callback(key, val, !!val.__factory)
    else if (isObject(val) && !isEmpty(obj)) forEachValue(val, callback)

  })

}

/* HELPER FUNCTIONS */
export const isSchema = (obj:any):boolean => {
  return obj != null && !!obj.__key && (!!obj.__this_is_a_schema__ || isSchemaRoot(obj))
}

export const isSchemaRoot = (obj:any):boolean => {
  return obj != null && obj.__key === '__root'
}

export const isSchemaEqual = (schemaA:any, schemaB:any):boolean => {

  return isSchema(schemaA) && isSchema(schemaB) && 
    schemaA.__key === schemaB.__key && 
    _.isEqual(Object.keys(schemaA), Object.keys(schemaB))

}

export const getSchema = (obj:any):boolean => {
  return obj.__get_object_schema__
}

export default NewSchema