import { activeEffect, trackEffect, triggerEffects } from "./effect";

const targetMap = new WeakMap(); // 存放依赖收集的关系

export const createDep = (cleanup, key) => {
  const dep = new Map() as any; // 创建的收集器还是一个map
  dep.cleanup = cleanup; // 在返回的map上挂一个清理函数
  dep.name = key; // 自定义的为了标识这个映射表是给哪个属性服务的
  return dep;
};

export function track(target, key) {
  // activeEffect 有这个属性 说明这个key是在effect中访问的，需要进行，依赖收集；没有说明在effect之外访问的不用进行收集

  if (activeEffect) {
    // console.log(target,key,activeEffect, targetMap)
    let depsMap = targetMap.get(target);

    if (!depsMap) { // 新增的
      targetMap.set(target, (depsMap = new Map()));
    }

    let dep = depsMap.get(key);

    if (!dep) {
      depsMap.set(
        key,
        (dep = createDep(() => depsMap.delete(key), key)) // 后面用于清理不需要的属性
      );
    }
    trackEffect(activeEffect, dep); // 将当前的activeEffect放入到dep（映射表）中， 后续可以根据值的变化触发此dep中存放的effect
  }
}

export function trigger(target, key, newValue, oldValue) {
  const depsMap = targetMap.get(target);

  if (!depsMap) {
    // 找不到对象 直接return即可
    return;
  }
  let dep = depsMap.get(key);
  if (dep) {
    // 修改的属性对应了effect
    triggerEffects(dep);
  }
}

// targetMap的结构如下：
// Map: {obj: {属性：Map:{reactiveEffect,reactiveEffect,reactiveEffect }}}
// {
//     {name:'jw',age:30}:{
//         age:{
//             reactiveEffect:0,
//             reactiveEffect:0
//         },
//         name:{
//             reactiveEffect ,reactiveEffect
//         }
//     }
// }
