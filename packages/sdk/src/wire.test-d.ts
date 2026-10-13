import type { ExpandTreeNode, CheckResponse } from './client.js';
import type { components } from './generated/runtime-api.js';

type Wire = components['schemas'];
type Assignable<A, B> = [A] extends [B] ? true : false;

const _expand: Assignable<Wire['ExpandTreeNode'], ExpandTreeNode> = true;
const _check: Assignable<Wire['CheckResponse'], CheckResponse> = true;
const _me: Assignable<Wire['MeResponse'], { storeId: string }> = true;
const _batch: Assignable<
  NonNullable<Wire['BatchCheckResponse']['result']>,
  Record<string, { allowed?: boolean }>
> = true;

void _expand;
void _check;
void _me;
void _batch;
