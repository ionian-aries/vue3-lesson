// reactive shallowReactive

import { activeEffect, trackEffect, triggerEffects } from "./effect";
import { toReactive } from "./reactive";
import { createDep } from "./reactiveEffect";

// ref   shallowRef
export function ref(value) {
  return createRef(value);
}
function createRef(value) {
  return new RefImpl(value);
}
class RefImpl {
  public __v_isRef = true; // 增加ref标识
  public _value; // 用来保存ref的值的
  public dep; // 用于收集对应的effect
  constructor(public rawValue) {
    this.rawValue = rawValue;
    this._value = toReactive(rawValue);
  }
  get value() {
    trackRefValue(this); // 收集依赖
    return this._value;
  }
  set value(newValue) {
    if (newValue !== this.rawValue) {
      this.rawValue = newValue; // 更新值
      this._value = newValue;
      triggerRefValue(this); // 触发依赖更新
    }
  }
}
export function trackRefValue(ref) {
  if (activeEffect) {
    trackEffect(
      activeEffect,
      (ref.dep = ref.dep || createDep(() => (ref.dep = undefined), "undefined")) // 当前ref的dep
    );
  }
}
export function triggerRefValue(ref) {
  let dep = ref.dep;
  if (dep) {
    triggerEffects(dep); // 触发依赖更新
  }
}

// toRef , toRefs

class ObjectRefImpl {
  public __v_isRef = true; // 增加ref标识
  constructor(public _object, public _key) {}
  get value() {
    // 获取值，读取this._object[this._key]时，会出发ref本身的get方法
    return this._object[this._key];
  }
  set value(newValue) {
    // 设置值，设置this._object[this._key]时，会出发ref本身的set方法
    this._object[this._key] = newValue;
  }
}
export function toRef(object, key) {
  return new ObjectRefImpl(object, key);
}

export function toRefs(object) {
  const res = {};
  for (let key in object) {
    // 挨个属性调用toRef
    res[key] = toRef(object, key);
  }
  return res;
}

// proxyRefs：自动脱ref
export function proxyRefs(objectWithRef) {
  return new Proxy(objectWithRef, {
    get(target, key, receiver) {
      let r = Reflect.get(target, key, receiver);
      return r.__v_isRef ? r.value : r; // 自动脱ref
    },
    set(target, key, value, receiver) {
      const oldValue = target[key];
      if (oldValue !== value){
        if (oldValue.__v_isRef) {
          oldValue.value = value; // 如果老值是ref 需要给ref赋值
          return true;
        } else {
          return Reflect.set(target, key, value, receiver);
        }
      }
    },
  });
}

export function isRef(value) {
  return value && value.__v_isRef;
}
