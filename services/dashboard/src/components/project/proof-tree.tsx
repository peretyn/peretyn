import type { ExpandTreeNode } from '@peretyn/sdk';
import { Badge } from '@peretyn/ui/components/badge';

export function ProofTree({ tree }: { tree: ExpandTreeNode | null }) {
  if (!tree) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing grants this relation - it resolves to no users.
      </p>
    );
  }
  return (
    <div className="font-mono text-xs">
      <TreeNode node={tree} />
    </div>
  );
}

function TreeNode({ node }: { node: ExpandTreeNode }) {
  return (
    <div className="flex flex-col gap-1">
      {node.name && <span className="text-muted-foreground">{node.name}</span>}
      {node.leaf && <Leaf leaf={node.leaf} />}
      {node.union && <Branch label="any of" nodes={node.union.nodes} />}
      {node.intersection && <Branch label="all of" nodes={node.intersection.nodes} />}
      {node.difference && (
        <div className="ml-3 flex flex-col gap-1 border-l pl-3">
          <TreeNode node={node.difference.base ?? {}} />
          <span className="text-muted-foreground">but not</span>
          <TreeNode node={node.difference.subtract ?? {}} />
        </div>
      )}
    </div>
  );
}

function Branch({ label, nodes }: { label: string; nodes?: ExpandTreeNode[] }) {
  return (
    <div className="ml-3 flex flex-col gap-1 border-l pl-3">
      <span className="text-muted-foreground">{label}</span>
      {nodes?.map((node, index) => (
        <TreeNode key={index} node={node} />
      ))}
    </div>
  );
}

function Leaf({ leaf }: { leaf: NonNullable<ExpandTreeNode['leaf']> }) {
  return (
    <div className="ml-3 flex flex-wrap gap-1 border-l pl-3">
      <LeafContent leaf={leaf} />
    </div>
  );
}

function LeafContent({ leaf }: { leaf: NonNullable<ExpandTreeNode['leaf']> }) {
  const users = leaf.users?.users ?? [];
  if (users.length > 0) {
    return users.map((user) => (
      <Badge key={user} variant="secondary" className="font-mono">
        {user}
      </Badge>
    ));
  }
  if (leaf.computed?.userset) {
    return (
      <Badge variant="outline" className="font-mono">
        {leaf.computed.userset}
      </Badge>
    );
  }
  if (leaf.tupleToUserset?.tupleset) {
    return <span className="text-muted-foreground">via {leaf.tupleToUserset.tupleset}</span>;
  }
  return <span className="text-muted-foreground">(none)</span>;
}
