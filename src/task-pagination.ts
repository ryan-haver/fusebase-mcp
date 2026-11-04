export interface TaskPage<T> { tasks: T[]; offset: number; limit: number; total: number }
/** FuseBase returns a mixed-entity range: limit is the exclusive end, not task count.
 * taskLists/boards may also contain referenced metadata, so their lengths are not cursors.
 */
export async function collectTaskPages<T, P extends TaskPage<T>>(fetchPage: (offset: number, limit: number) => Promise<P>, id: (task: T) => string): Promise<{first:P; tasks:T[]}> {
  const tasks:T[]=[];const seen=new Set<string>();let first:P|undefined;let offset=0;
  for(let page=0;page<1000;page++) {
    const result=await fetchPage(offset,100);first??=result;
    if(!Array.isArray(result.tasks) || ![result.offset,result.limit,result.total].every(Number.isSafeInteger) || result.offset!==offset || result.total<0 || result.limit>result.total || result.limit<offset) throw new Error("Invalid task pagination range");
    for(const task of result.tasks){const key=id(task);if(!key||seen.has(key))throw new Error("Task pagination repeated or omitted an identifier");seen.add(key);tasks.push(task);}
    if(result.limit>=result.total)return {first,tasks};
    if(result.limit<=offset)throw new Error("Task pagination made no progress");
    offset=result.limit;
  }
  throw new Error("Task pagination exceeded safe bound");
}
