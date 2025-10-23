import type { DataNode, EventDataNode } from "antd/es/tree";

import type { Category } from "../../api/categories";

import type { CategoryLookups, ParentKey, TreeDataNode } from "./types";

export function buildFilteredTree(
  nodes: Category[],
  parentId: ParentKey,
  search: string,
) {
  const trimmed = search.toLowerCase();
  if (!trimmed) {
    return { nodes: buildTreeData(nodes, parentId), matchedKeys: new Set<string>() };
  }
  const matchedKeys = new Set<string>();
  const filtered = filterNodes(nodes, parentId, [], matchedKeys, trimmed);
  return { nodes: filtered, matchedKeys };
}

export function buildTreeData(
  nodes: Category[],
  parentId: ParentKey,
): TreeDataNode[] {
  const sorted = sortCategories(nodes);
  return sorted.map((node) => ({
    key: node.id.toString(),
    title: node.name,
    parentId,
    children: buildTreeData(node.children ?? [], node.id),
  }));
}

function filterNodes(
  nodes: Category[],
  parentId: ParentKey,
  ancestors: string[],
  matchedKeys: Set<string>,
  search: string,
): TreeDataNode[] {
  const sorted = sortCategories(nodes);
  const result: TreeDataNode[] = [];
  sorted.forEach((node) => {
    const key = node.id.toString();
    const childAncestors = [...ancestors, key];
    const children = filterNodes(
      node.children ?? [],
      node.id,
      childAncestors,
      matchedKeys,
      search,
    );
    const nameMatch = node.name.toLowerCase().includes(search);
    const includeNode = nameMatch || children.length > 0;
    if (!includeNode) {
      return;
    }
    if (nameMatch || children.length > 0) {
      matchedKeys.add(key);
      ancestors.forEach((ancestorKey) => matchedKeys.add(ancestorKey));
    }
    result.push({
      key,
      title: node.name,
      parentId,
      children: children.length > 0 ? children : undefined,
    });
  });
  return result;
}

export function buildLookups(nodes: Category[]): CategoryLookups {
  const byId = new Map<number, Category>();
  const parentToChildren = new Map<ParentKey, Category[]>();

  const walk = (list: Category[], parentId: ParentKey) => {
    const sorted = sortCategories(list);
    parentToChildren.set(parentId, sorted);
    sorted.forEach((node) => {
      byId.set(node.id, node);
      if (node.children && node.children.length > 0) {
        walk(node.children, node.id);
      }
    });
  };

  walk(nodes, null);
  return { byId, parentToChildren };
}

export function sortCategories(nodes: Category[]): Category[] {
  return [...nodes].sort((a, b) => {
    if (a.position !== b.position) {
      return a.position - b.position;
    }
    return a.name.localeCompare(b.name, "zh-CN");
  });
}

export function getParentId(node: EventDataNode<TreeDataNode>): number | null {
  return (node as unknown as TreeDataNode).parentId ?? null;
}
