import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {it, expect} from "vitest";
import {ItemDimensionPanel, OverrideEditor} from "../src/dimension-ui";
import {blank, entitySchema, worldSchema, worldFolderSchema, recordOverrideSchema, initialState} from "../src/model";

function setup() {
  const now = new Date().toISOString();
  const folder = worldFolderSchema.parse({id:"f",name:"世界群",createdAt:now,updatedAt:now,dimensionAxes:[{id:"line",name:"世界線",options:[{id:"back",name:"BACKSIDE"}]}]});
  const world = worldSchema.parse({content:{world:blank("世界"),entities:[],relations:[],events:[],collections:[]},snapshots:[],folderId:folder.id});
  const record = entitySchema.parse({...blank("キャラ"),kind:"character",worldId:world.content.world.id,summary:"基本の概要",overrides:[recordOverrideSchema.parse({id:"o",conditions:[{axisId:"line",optionId:"back"}],patch:{summary:"別の概要",visible:false}})]});
  world.content.entities.push(record);
  return {world,folder,record,state:{...initialState(),worlds:[world],worldFolders:[folder]}};
}
it("opens the existing exact override immediately and includes before/after confirmation", () => {
  const {world,folder,record} = setup();
  const html = renderToStaticMarkup(<OverrideEditor world={world} folder={folder} selection={{line:"back"}} revision={0} save={async () => {}} target={"record:"+record.id} changeTarget={() => {}} fixedTarget />);
  expect(html).toContain("差分を更新"); expect(html).toContain("別の概要"); expect(html).toContain("基本の概要");
  expect(html).toContain("保存後のこの条件"); expect(html).not.toContain("対象を探す"); expect(html).toContain("移動／複製");
});
it("keeps a hidden item manageable in context", () => {
  const {world,folder,record,state} = setup();
  const html = renderToStaticMarkup(<ItemDimensionPanel state={state} world={world} folder={folder} recordId={record.id} selection={{line:"back"}} changeSelection={() => {}} save={async () => {}} />);
  expect(html).toContain("世界線：BACKSIDE"); expect(html).toContain("この条件では非掲載");
  expect(html).toContain("このDimensionで編集"); expect(html).toContain("この条件の掲載指定");
});
it("base view offers creation/management without a conditional visibility write", () => {
  const {world,folder,record,state} = setup();
  const html = renderToStaticMarkup(<ItemDimensionPanel state={state} world={world} folder={folder} recordId={record.id} selection={{}} changeSelection={() => {}} save={async () => {}} />);
  expect(html).toContain("表示中：基本データ"); expect(html).toContain("別の姿を作る／管理"); expect(html).not.toContain("この条件の掲載指定");
});
