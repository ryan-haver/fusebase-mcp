import {expect,it,vi} from "vitest";
import {collectTaskPages} from "../../src/task-pagination.js";
it("follows mixed-entity ranges even when few tasks are returned",async()=>{
 const fetch=vi.fn(async(offset:number)=>offset===0?{offset:0,limit:100,total:151,tasks:[{id:"first"}]}:{offset:100,limit:151,total:151,tasks:[{id:"last"}]});
 expect((await collectTaskPages(fetch,(task:{id:string})=>task.id)).tasks.map(t=>t.id)).toEqual(["first","last"]);
 expect(fetch).toHaveBeenLastCalledWith(100,100);
});
it("fails closed if the task server ignores the cursor",async()=>{
 await expect(collectTaskPages(async()=>({offset:0,limit:100,total:151,tasks:[{id:"same"}]}),(t:{id:string})=>t.id)).rejects.toThrow("range");
});
