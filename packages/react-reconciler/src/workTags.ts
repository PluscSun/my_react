export type WorkTags =
  | typeof FunctionComponent
  | typeof HostRoot
  | typeof HostComponent
  | typeof HostText;

export const FunctionComponent = 0 as const;
// 项目根节点，ReactDom.render
export const HostRoot = 3 as const;

// <div>
export const HostComponent = 5 as const;
// <div>123
export const HostText = 6 as const;