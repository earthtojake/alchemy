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
type GetPath = () => Path

type ValidateOptions = {
  basePath?: Path,
  ignoreRequired?: boolean,
}
type Validate = (obj: any, options?: ValidateOptions) => boolean

type GetParent = () => any

type Create<BaseType> = (obj: any) => BaseType

type BaseProps = {
  path: GetPath,
  validate: Validate,
  parent: GetParent,
}

// child can be array or dictionary
type TypeConstructor = StringConstructor | BooleanConstructor | NumberConstructor

type SchemaValue = {
  type: TypeConstructor
  typeof: string,
  default?: any,
  required?: boolean,
  max?: number,
  min?: number,
}

type ModelValue = TypeConstructor | {
  type: TypeConstructor,
  default?: any,
  required?: boolean,
  max?: number,
  min?: number,
}

type Model<BaseType> = {
  [K in keyof BaseType]:
    BaseType[K] extends ModelValue ? ModelValue :
    BaseType[K] extends Schema<BaseType> ? Schema<BaseType[K]> :
    BaseType[K] extends object ? Model<BaseType[K]> :
    ModelValue;
}

type Schema<BaseType, ExtraProps = {}> = 
  Create<BaseType> & 
  {
    [K in keyof BaseType]:
      BaseType[K] extends object ? Schema<BaseType[K], ExtraProps>:
      SchemaValue & ExtraProps & BaseProps;
  } & 
  ExtraProps & BaseProps

/* HELPER FUNCTIONS */
const isObject = (value:any):boolean => {
  return (typeof value === 'object' && value !== null)
}

const isFactoryKey = (obj:any):boolean => {
  if (!isObject(obj)) return false
  const props = Object.keys(obj)
  return (props.length === 1 || !!obj.__root)
    && strToTypeConstructor(props[0]) === String
}

const isArrayKey = (obj:any):boolean => {
  if (!isObject(obj)) return false
  return Array.isArray(obj) && obj.length === 1
}

const typeCons:Array<any> = [String, Number, Boolean, Date]
const typeConsStrs = typeCons.reduce((typeStrs:object, typeCon:any) => {
  return {
    ...typeStrs,
    [typeCon]: typeCon,
  }
}, {})

// returns type constructor from string
function strToTypeConstructor(typeStr:string):TypeConstructor {
  return typeConsStrs[typeStr]
}

// return typeof constructor
function typeOfConstructor(typeCon:TypeConstructor):string {
  switch (typeCon) {
    case String:
      return "string"
    case Number:
      return "number"
    case Boolean:
      return "boolean"
    default:
      return undefined
  }
}

function isTypeConstructor(obj:any):boolean {
  return obj !== null && obj !== undefined && !!typeConsStrs[obj.toString()]
}

function isSchemaValue(obj:any):boolean {

  return obj !== null && obj !== undefined && (
    isTypeConstructor(obj) || // raw type
    (isObject(obj) && isTypeConstructor(obj.type)) // object with "type" property
  )

}

const defaultSchemaValue: SchemaValue = {
  type: undefined,
  typeof: undefined,
  default: undefined,
  required: false,
  min: undefined,
  max: undefined,
}

/* MODEL GENERATOR */
function Schema<
  BaseType = {}, 
  ExtraProps = {}
>(
  schema: Model<BaseType>,
  extraProps: ExtraProps
): Schema<BaseType, ExtraProps> {

  // todo: ensure extra props do not clash with reserved props

  const baseReservedProps = {
    ...(<any>Object).keys(extraProps || {}).reduce((obj, key) => {
      obj[key] = true
      return obj
    }, {}),
    path: true,
    validate: true,
    parent: true,
    __factory: true,
    __leaf: true,
  }

  const handler = {

    get: function(obj, prop) {

      // context from parent
      const factoryValue = obj.__factory
      const isFactory = !!factoryValue

      const isRoot = !!obj.__root

      const isLeaf = !!obj.__leaf

      const getPrevPath: GetPath = isRoot? () => [] : obj.path

      // reserved properties
      let reservedProps = baseReservedProps
      if (isLeaf) {
        reservedProps = {
          ...reservedProps,
          ...(<any>Object).keys(defaultSchemaValue).reduce((obj, key) => {
            obj[key] = true
            return obj
          }, {}),
        }
      }
  
      // value
      let value = obj[prop]
      if (isFactory) value = factoryValue

      // parse value
      if (isObject(value)) {
        if (value instanceof Schema) {
          value = (<any>Object).assign({}, value)
        }
      }

      let ret = undefined
    
      // create getters
      const path = (): Array<string> => {
        const _getPrevPath = getPrevPath ? getPrevPath : () => []
        return (_getPrevPath()).concat(!isRoot ? [prop] : [])
      }
  
      const getters = {
  
        // base path getter
        path,

        // base validator
        validate,

        // get parent
        parent: () => isRoot ? undefined : obj,
  
        // extra getters
        ...(<any>Object).keys(extraProps || {}).reduce((obj, key) => {
  
          return {
            ...obj,
            [key]: (...args) => extraProps[key].bind(ret)(...args)
          }
  
        }, {})
  
      }
  
      if (reservedProps[prop]) {

        ret = obj[prop]
        
      } else if (isSchemaValue(value)) {

        const isObj = !isTypeConstructor(value)

        const valueFeatures = {
          ...defaultSchemaValue,
          ...value,
          typeof: typeOfConstructor(isObj ? value.type : value),
        }
        
        // return getters for leaf values of schema
        ret = new Proxy({
          __leaf: true,
          ...valueFeatures,
          ...getters,
        }, handler)
        
      } else if (isObject(value)) {
  
        // nested object
        if (isFactoryKey(value) || isArrayKey(value)) {
          
          // return node with child creator
          const factoryKey = Object.keys(value)[0]
          const child = value[factoryKey]

          ret = new Proxy({
            __factory: child,
            ...getters,
          }, handler)
    
        } else {
  
          // return basic node
          ret = new Proxy({
            ...value,
            ...getters,
          }, handler)
  
        }
  
      } else {

        ret = value
        
      }

      return ret

    },

  }

  

  let {__root}:any = new Proxy({
    __root: {
      ...schema,
    },
  }, handler);

  const ret = __root

  if (this instanceof Schema) {
    // assign "this"
    Object.keys(ret).forEach(key => {
      this[key] = ret[key]
    })
  }

  return ret as Schema<BaseType, ExtraProps>

}

function validate(obj: any, options: ValidateOptions = {}) {

  const {
    basePath = [],
    ignoreRequired = false,
  } = options
    
  const validateValue = (value: any, schema: any, _path?: Array<string>) => {

    if (!schema) {
      const pathStr = _path ? `[${_path.join(', ')}]` : ''
      throw Error(`Schema violation at ${pathStr}: Path does not exist in schema`)
    }
      
    const path = schema.path()
    const pathStr = `[${path.join(', ')}]`
    const valStr = value ? `${value.toString()}` : ''

    if (value && schema.typeof !== typeof value) {
      const typeStr = typeof value
      throw Error(`Schema violation at ${pathStr}: Invalid type '${typeStr}' for value '${valStr}', should be type '${schema.typeof}'`)
    }
    if (!value && schema.required && !ignoreRequired) {
      throw Error(`Schema violation at ${pathStr}: marked as required, got '${valStr}'`)
    }
    if (value && schema.type === Number && (schema.min || schema.max)) {
      if (value < schema.min) throw Error(`Schema violation at ${pathStr}: Value ${valStr} below minimum ${schema.min}`)
      else if (value > schema.max) throw Error(`Schema violation at ${pathStr}: Value ${valStr} above maximum ${schema.max}`)
    }

    return true

  }

  const _validate = function(obj, basePath = [], thisObj) {

    if (!isObject(obj)) {
      validateValue(obj, thisObj)
      return {
        [basePath.join('.')]: true
      }
    }

    const pathsObj = flat.flatten(obj)
    let validatedPaths = {}

    forEachValue(thisObj, (key, val, isFactory) => {

      const path = val.path()
      const relPath = path.slice(basePath.length)

      if (isFactory) {

        const factorySchema = _.get(thisObj, relPath)

        const objVals = (<any>Object).keys(pathsObj).reduce((objVals, dotPath) => {
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
            ..._validate(objVals[key].val, objVals[key].path, factorySchema[key])
          }
        })

      } else {

        const relPath = path.slice(basePath.length)

        const schema = _.get(thisObj, relPath)
        const val = _.get(obj, relPath)

        validateValue(val, schema)
        validatedPaths[basePath.concat(relPath).join('.')] = true

      }

    })

    return validatedPaths

  }

  // edge-case for single value
  if (!isObject(obj)) {
    validateValue(obj, this)
    return true
  }

  const objectPaths = flat.flatten(obj)
  const validatedPaths = _validate(obj, basePath, this)

  Object.keys(validatedPaths).forEach(path => {
    delete objectPaths[path]
  })

  Object.keys(objectPaths).forEach(path => {
    const val = objectPaths[path]
    const schema = _.get(this, path)
    validateValue(val, schema, path.split('.'))
  })

  return true

}

type ForEachValueCallback = (key: string | number, obj: any, isFactory?: boolean) => void

function forEachValue(obj: any, callback: ForEachValueCallback) {

  Object.keys(obj).forEach(key => {

    let val = obj[key]

    if (!val) return

    if (typeof val === 'function') return
    else if (val.__leaf || val.__factory) callback(key, val, !!val.__factory)
    else if (isObject(val)) forEachValue(val, callback)

  })

}

type ExtraProps = {
  dotPath: () => string,
  flatten: (obj: any, delimiter?: string) => object,
  flatMap: (obj: any, map: (val: any) => any, delimiter?: string) => object
}

const props: ExtraProps = {

  dotPath: function() {
    return this.path().join('.')
  },

  flatten: function(obj, delimiter = '.') {

    this.validate(obj, {
      ignoreRequired: true,
    })

    const flatObj = flat.flatten(obj, {delimiter})
    let basePath = this.path().join(delimiter)
    if (basePath) basePath += delimiter
    return Object.keys(flatObj).reduce((ret, path) => ({
      ...ret,
      [basePath + path]: flatObj[path]
    }), {})

  },

  flatMap: function(obj, map = val => val, delimiter = '.') {

    const flatObj = this.flatten(obj, delimiter)

    return Object.keys(flatObj).reduce((ret, key) => ({
      ...ret,
      [key]: map(flatObj[key])
    }), {})

  }

}

const $uid: any = String

type User = {
  info: {
    name: string,
    dob: number,
    hello?: string,
  },
  friends?: {
    [key: string]: boolean
  }
}

type Root = {
  users: {
    [$uid: string]: User
  }
}

const User: Model<User> = {
  info: {
    name: String,
    dob: { type: Number, required: true, min: 50, max: 200 },
    hello: { type: String, default: 'world' },
  },
  friends: {
    [$uid]: { type: Boolean, required: true }
  },
}

const UserSchema: Schema<User, ExtraProps> = Schema(
  User,
  props,
)

const Root: Model<Root> = {
  users: {
    [$uid]: UserSchema
  }
}

const RootSchema: Schema<Root, ExtraProps> = Schema(
  Root,
  props,
)

const testObj: Root = {
  users: {
    A: {
      info: {
        name: 'jake',
        dob: 80,
      },
      friends: {
        B: true,
      },
    },
    B: {
      info: {
        name: 'blake',
        dob: 199,
      }
    }
  }
}

const userObj = {
  info: {
    name: 'jake',
    dob: 180,
  },
  friends: {
    A: true,
    B: true,
  }
}

// const user = UserSchema(userObj)
// console.log(user)

const user = UserSchema('abc')

RootSchema.validate(testObj)
UserSchema.validate(testObj.users.A)
UserSchema.validate(testObj.users.B)