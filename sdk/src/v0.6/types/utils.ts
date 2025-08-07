export type LowercaseKeys<T> = {
  [K in keyof T as Lowercase<string & K>]: T[K];
};
