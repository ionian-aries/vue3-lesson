import { activeEffect } from "./effect";

export function track(target, key) {
  // activeEffect 有这个属性 说明这个key是在effect中访问的，没有说明在effect之外访问的不用进行收集

  if (activeEffect) {
    console.log(target, key, activeEffect);
  }
}
// {
//     {name:'jw',age:30}:{
//         age:{
//             effect
//         },
//         name:{
//             effect ,effect
//         }
//     }
// }
