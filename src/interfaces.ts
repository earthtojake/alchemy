import { SCHEMA_ROOT_KEY, SCHEMA_FACTORY_KEY, SCHEMA_KEY, SCHEMA_VALUE_KEY } from "./index";
import { FirebaseMethods } from "./firebase";

// proxy typescript hack
declare interface ProxyHandler<T> {}
interface ProxyConstructor {
  revocable<T extends object>(target: T, handler: ProxyHandler<T>): { proxy: T; revoke: () => void; };
  new <T extends object>(target: T, handler: ProxyHandler<T>): T;
}
declare var Proxy: ProxyConstructor;

/* SCHEMA PROPS */

export type KeyPath = Array<string>

export type ValueReducer<T> = (value: any, schema: SchemaValue<T>, keyPath: KeyPath, options?: object) => any

export type Validate<T> = (obj: any, options?: ValidateOptions) => T
export type ValidateOptions = {
  ignoreRequired?: boolean,
}

// TODO: add parent type to interfaces
export type GetParent = () => any

export type Cast<T> = (obj: any) => T

export type GetKeyPath = () => KeyPath

export type SchemaProps<T> = {
  [SCHEMA_KEY]: string,
  [SCHEMA_FACTORY_KEY]?: any,
  validate: Validate<T>,
  parent: GetParent,
  cast: Cast<T>,
  keyPath: GetKeyPath,
} & FirebaseMethods<T>

// strings, booleans, numbers only
export type RawValue = string | number | boolean
export type TypeConstructor = StringConstructor | BooleanConstructor | NumberConstructor
export type TypeString = 'string' | 'String' | 'boolean' | 'Boolean' | 'number' | 'Number'

export interface SchemaValueOptions {
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
  get?: (val: RawValue) => any,
  set?: (val: RawValue) => any,
}

export type SchemaValue<T> = {
  [SCHEMA_VALUE_KEY]: boolean,
  type: TypeConstructor
  typeof: TypeString,
} & SchemaValueOptions & SchemaProps<T>

export type BaseSchema<T> = 
  Schema<T> &
  { 
    [SCHEMA_ROOT_KEY]: boolean // include root key for special base case
  }

export type Schema<T> = {
  [K in keyof T]:
    // check for a value (type constructor or type object)
    T[K] extends ModelValue ? SchemaValue<T[K]>:
    // check for nested object
    T[K] extends object ? Schema<T[K]>:
    // default to value
    SchemaValue<T[K]>;
} & SchemaProps<T>

/* MODEL TYPES */

export type ModelValue = TypeConstructor | TypeString | {
  type: TypeConstructor | TypeString,
} & SchemaValueOptions

export type Model<T> = {
  [K in keyof T]:
    T[K] extends ModelValue ? ModelValue :
    T[K] extends Schema<T> ? Schema<T[K]> :
    T[K] extends object ? Model<T[K]> :
    ModelValue;
}