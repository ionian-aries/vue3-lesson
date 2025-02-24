import { DirtyLevels } from "./constants";

  // 创建一个响应式effect，默认执行一次，并且数据变化后可以重新执行
export function effect(fn, options?) {
  // 创建一个effect，只要依赖的属性变化了就要执行回调
  const _effect = new ReactiveEffect(fn, () => {
    // scheduler
    _effect.run();
  });
  _effect.run(); // 默认执行一次

  if (options) {
    Object.assign(_effect, options); // 用用户传递的覆盖掉内置的
  }

  const runner = _effect.run.bind(_effect);
  runner.effect = _effect; // 可以在run方法上获取到effect的引用（effect在run方法中获取到自己）
  return runner; // 外界可以自己让其重新run
}

function preCleanEffect(effect) {
  effect._depsLength = 0; //  dep从0开始比较，处理分支切换的情况
  effect._trackId++; // 每次执行id 都是+1， 如果当前同一个effect执行，id就是相同的， 用于处理一次处理多个相同属性的情况， 同一id，只需收集一次
}

// 依赖收集完成后，清除不需要的多余依赖
function postCleanEffect(effect) {
  // [flag,a,b,c]
  // [flag]  -> effect._depsLength = 1
  if (effect.deps.length > effect._depsLength) {
    for (let i = effect._depsLength; i < effect.deps.length; i++) {
      cleanDepEffect(effect.deps[i], effect); // 删除映射表中对应的effect
    }
    effect.deps.length = effect._depsLength; // 更新依赖列表的长度
  }
}
// effectScope.stop() 停止所有的effect 不参加响应式处理

export let activeEffect; // 当前的effect

export class ReactiveEffect {
  _trackId = 0; // 用于记录当前effect执行了几次
  _depsLength = 0;
  _running = 0;
  _dirtyLevel = DirtyLevels.Dirty;
  deps = []; // 还想记录effect和dep的关联关系
  public active = true; // 加点状态，创建的effect是否时响应式的，更改此属性，可以停用响应式

  // fn： 用户编写的函数
  // scheduler： 调度函数，如果fn中依赖的数据发生变化后，需要重新调用 -> run()
  constructor(public fn, public scheduler) {}

  public get dirty() {
    return this._dirtyLevel === DirtyLevels.Dirty;
  }

  public set dirty(v) {
    this._dirtyLevel = v ? DirtyLevels.Dirty : DirtyLevels.NoDirty;
  }
  run() {
    this._dirtyLevel = DirtyLevels.NoDirty; // 每次运行后effect变为no_dirty
    // 让fn执行
    if (!this.active) {
      return this.fn(); // 不是激活的，执行后，什么都不用做
    }
    let lastEffect = activeEffect;
    try {
      activeEffect = this;

      // effect重新执行前，需要将上一次的依赖情况  effect.deps

      preCleanEffect(this); // 依赖收集前，“清空”上一次存储的deps
      this._running++;
      return this.fn(); // 做依赖收集，执行这个fn时会去读 state.name  state.age，在此时做依赖收集
    } finally {
      this._running--;
      postCleanEffect(this);
      activeEffect = lastEffect;
    }
    // 使用try-finally，在effect执行完后，把activeEffect还原，这样在effect之外访问的属性，不会被收集
  }
  stop() {
    if (this.active) {
      this.active = false; // 后续来实现
      preCleanEffect(this);
      postCleanEffect(this);
    }
  }
}
// 双向记忆

function cleanDepEffect(dep, effect) {
  dep.delete(effect);
  if (dep.size == 0) {
    dep.cleanup(); // 如果map为空，则删除这个属性
  }
}

// 1._trackId 用于记录执行次数 (防止一个属性在当前effect中多次依赖收集) 只收集一次
// 2.拿到上一次依赖的_depsLength个reactiveEffect和这次的比较
// {flag,age}
export function trackEffect(effect, dep) {
  // 收集时一个个收集的
  // ！！需要重新的去收集依赖 ， 将不需要的移除掉
  // console.log(effect, dep);

  // 🌈trackId 是effect执行的次数，
  // 1.同一次effect内的属性只需要收集一次
  // 2.不同的effect，才需要比较，然后进行收集
  if (dep.get(effect) !== effect._trackId) {
    dep.set(effect, effect._trackId); // 更新id
    // {flag,name} 第一次
    // {flag,age} 第二次
    let oldDep = effect.deps[effect._depsLength];
    // 如果没有存过
    if (oldDep !== dep) {
      if (oldDep) {
        // 删除掉老的
        cleanDepEffect(oldDep, effect);
      }
      // 换成新的
      effect.deps[effect._depsLength++] = dep; // 永远按照本次最新的来存放
    } else {
      effect._depsLength++;
    }
  }

  // dep.set(effect, effect._trackId);
  // // 我还想让effect和dep关联起来
  // effect.deps[effect._depsLength++] = dep;
}

export function triggerEffects(dep) {
  for (const effect of dep.keys()) {
    // 当前这个值是不脏的，但是触发更新需要将值变为脏值

    // 属性依赖了计算属性， 需要让计算属性的drity在变为true
    if (effect._dirtyLevel < DirtyLevels.Dirty) {
      effect._dirtyLevel = DirtyLevels.Dirty;
    }
    if (!effect._running) {
      if (effect.scheduler) {
        // 如果不是正在执行，才能执行
        effect.scheduler(); // -> effect.run()
      }
    }
  }
}
