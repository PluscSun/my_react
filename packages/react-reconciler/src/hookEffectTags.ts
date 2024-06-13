// 以下都是针对EffectHook来说的，注意和fiber flags PassiveEffect区分

// useEffect对应的Effect Tag
export const Passive = 0b0010;

// 当前effect本次更新存在副作用
export const HookHasEffect = 0b0001;
