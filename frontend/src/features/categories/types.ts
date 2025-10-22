import type { DataNode } from "antd/es/tree";

import type { Category } from "../../api/categories";

export type ParentKey = number | null;

export type TreeDataNode = DataNode & {
  parentId: number | null;
  children?: TreeDataNode[];
};

export interface CategoryLookups {
  byId: Map<number, Category>;
  parentToChildren: Map<ParentKey, Category[]>;
}
