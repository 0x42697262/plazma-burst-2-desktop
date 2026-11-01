import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseParams, parseParamTable, parseCategories, parseMarkPairs, check } from './parse.ts';

const SRC = `
function addTrigger(trigger_type_id, description, paramA, paramB ) { /* the editor's own */ }
addTrigger(-1, 'Do nothing', 'nochange', 'nochange');
addTrigger(0, "Movable &#8250; Force Movable 'A' move to region 'B'", 'door', 'region'); AddOpcodeAlias('MovableTo');
//addTrigger(6, "Region &#8250; old", 'region', 'value');
addTrigger(6, "Region &#8250; Make damage in Region 'B' with <b>power</b> of 'A' hit points", 'value', 'region'); AddOpcodeAlias('DamageRegion');
/* addTrigger(7, "commented", 'x', 'y'); AddOpcodeAlias('Gone'); */
addTrigger(8, "Url &#8250; see http://example.com/a // not a comment", "string", "nochange");
addTrigger(9, "Twice", "string", "string"); AddOpcodeAlias('Same');
addTrigger(10, "Twice again", "string", "string"); AddOpcodeAlias('Same');
//addTrigger(11, "x", 'a', 'b'); AddOpcodeAlias('CommentedAlias');
addTrigger(12, "No alias, after a commented one", "string", "string");
`;

test('fetch-opcodes reads actions and aliases like the editor registers them', () => {
  const { actions, aliases } = parseParams(SRC);
  assert.deepEqual(Object.keys(actions).map(Number).sort((first, second) => first - second), [-1, 0, 6, 8, 9, 10, 12]);
  assert.deepEqual(actions[6], { desc: "Region › Make damage in Region 'B' with power of 'A' hit points", a: 'value', b: 'region', alias: 'DamageRegion' });
  assert.equal(actions[8]?.desc, 'Url › see http://example.com/a // not a comment');
  assert.equal(actions[12]?.alias, undefined, 'an alias in a comment belongs to nothing');
  assert.deepEqual(aliases, { MovableTo: 0, DamageRegion: 6, Same: 9 }, 'a name used twice is the lower number');
  assert.match(check({ actions, aliases }).join('\n'), /only 7 actions found/);
});

test('fetch-opcodes reads the editor\'s object parameters and value lists', () => {
  const src = String.raw`
param_type[0] = 	['uid', 'string', 			'ID', 			'Object ID', '*'];
param_type[23] = 	['use_on', 'region_activation',	'Activation on',		'Determines when trigger which is defined by "Activation Trigger" parameter runs', 'region'];
//param_type[35] = 	['hero1_guns', 'engine_mark',			'Modificator',	'Game modificator', 'engine_mark'];
for (var i=1;i<=trigger_actions_limit;i++) param_type[param_type.length] = ['actions_'+i+'_type', 'trigger_type', 'Action', 'x', 'trigger'];
special_values_table['side']=new Array();
special_values_table['side'][-1]="&#9668; Left";
special_values_table['bool']['true']="Yes";
special_values_table['region_activation'][1]='\'\'USE\'\' key (with button)';
special_values_table['maxcalls']['[val]']='# calls';
`;
  const { params, values } = parseParamTable(src);
  assert.deepEqual(params.map((param) => param.name), ['uid', 'use_on'], 'not the commented one, not the loop');
  assert.equal(params[1]?.desc, 'Determines when trigger which is defined by "Activation Trigger" parameter runs');
  assert.deepEqual(values, {
    side: { '-1': '◄ Left' }, bool: { true: 'Yes' }, region_activation: { 1: "''USE'' key (with button)" },
    maxcalls: { '[val]': '# calls' },
  });
});

test('fetch-opcodes gives the action categories the editor\'s colours, in the order it meets them', () => {
  const src = String.raw`
var rainbow=['#5f6887',
'#94a4c1', '#efefef'];
addTrigger(-1, 'Do nothing', 'nochange', 'nochange');
addTrigger(0, "Movable &#8250; Force Movable 'A' move to region 'B'", 'door', 'region');
//addTrigger(5, "Ghost &#8250; commented", 'x', 'y');
addTrigger(2, "Region &#8250; Quickly move Region", 'region', 'region');
addTrigger(1, "Movable &#8250; Change Speed", 'door', 'value');
`;
  assert.deepEqual(parseCategories(src), [{ name: 'Movable', color: '#5f6887' }, { name: 'Region', color: '#94a4c1' }]);
});

test('fetch-opcodes reads the editor server\'s model and skin lists (script that fills special_values_table)', () => {
  const reply = String.raw`special_values_table['char']['-1']='Death Match model';					{
						let img = new Image();
						img.loaded = false;
						CACHED_CHARS['-1'] = img;						CUSTOM_IMAGES_APPROVED['-1'] = true;
					}
					special_values_table['char']['1']='Campaign Hero model';					{ let img = new Image(); img.src = 'chars_full/char0001.png'; }
special_values_table['char']['77']='Raven by A Coniferous Chair';`;
  assert.deepEqual(parseParamTable(reply).values, { char: { 1: 'Campaign Hero model', 77: 'Raven by A Coniferous Chair', '-1': 'Death Match model' } });
});

test('fetch-opcodes reads which engine marks give their parameter a kind of its own (mark_pairs)', () => {
  const src = String.raw`var mark_pairs = new Array(); // for all cases of pair parameters
	mark_pairs['trigger_type_A'+trigger_type_id]=paramA;
mark_pairs['mark_sky'] = 'sky_model';
mark_pairs['mark_he_nades_count'] = 'value>=0+round1';
// mark_pairs['mark_old'] = 'gone';
mark_pairs['mark_watercolor']="string";`;
  assert.deepEqual(parseMarkPairs(src), { sky: 'sky_model', he_nades_count: 'value>=0+round1', watercolor: 'string' });
});

test('fetch-opcodes reads the minified editor bundle too', () => {
  const src = 'addTrigger(0,"Movable &#8250; Force Movable \'A\' move to region \'B\'","door","region"),AddOpcodeAlias("MovableTo"),'
    + 'param_type[23]=["use_on","region_activation","Activation on","When it runs","region"],'
    + 'special_values_table.region_activation[1]="\'\'USE\'\' key",special_values_table["textmsg"]["[color]"]="Custom color",'
    + 'mark_pairs.mark_sky="sky_model",x=1';
  assert.deepEqual(parseParams(src).aliases, { MovableTo: 0 });
  const { params, values } = parseParamTable(src);
  assert.equal(params[0]?.name, 'use_on');
  assert.deepEqual(values, { region_activation: { 1: "''USE'' key" }, textmsg: { '[color]': 'Custom color' } });
  assert.deepEqual(parseMarkPairs(src), { sky: 'sky_model' });
});
