# 封獣工廠ヴァルガ — 画像生成プロンプト集

生成した画像を `assets/beasts/<ID>.webp`（PNGで渡してくれればこちらで変換する） に置き、`js/manifest.js` の `beasts` にIDを追加すると、ゲーム内の影体（仮の絵）が差し替わる。全部そろわなくても、置いたものから順に反映される。

## 出力仕様（全魔獣共通）

| 項目 | 指定 |
|---|---|
| サイズ | 1024×1024（正方形） |
| 形式 | PNG、**背景透過**（透過できない生成器なら、単色の背景で出してから背景除去ツールにかける） |
| 構図 | **全身**、画面の下端に足（接地点）、上下左右に少し余白 |
| 向き | **左向き**（斜め45°の3/4ビュー）。プレイヤー側に出るときはゲームが左右反転する |
| 文字 | 入れない（ロゴ・サイン・枠も不要） |

## 共通スタイル（毎回、先頭に付ける）

```
Full-body character design of a monster for a dark fantasy card battle game, facing left in three-quarter view, standing on the ground, entire body visible with small margins, transparent background, no text, no frame.
Style: Japanese dark fantasy, ink-and-brush linework with painterly cel shading, inspired by ukiyo-e woodblock prints but rendered as modern high-detail game art. Muted, smoky base palette with ONE strong glowing accent color. Dramatic rim light from upper right, deep shadows, readable silhouette at small size. Menacing, elegant, not cute, not chibi.
```

一貫性のコツ：同じ生成器・同じスタイル文で全部作る。Midjourney なら `--sref` で1枚目を参照、GPT系なら1枚目を添付して「この画風で」と指示すると揃いやすい。

---

## 通常の魔獣（27体）

### ignivolg — イグニヴォルグ（焦土の狼王）
```
A colossal wolf king made of charred black fur and cracked obsidian skin, magma glowing through the cracks, a mane and tail of living orange flame, embers trailing from its paws, scarred muzzle with molten fangs. Accent color: orange fire.
```

### vulcanos — ヴァルカノス（熔鉄の巨神）
```
An ancient hulking siege golem of riveted black iron plates, a molten lava heart visible through a cracked chest grate, huge forge-hammer fists, chimney vents on its shoulders pouring smoke, glowing slit eyes. Accent color: molten orange.
```

### homura — 焔姫ホムラ（灰燼の巫女剣士）
```
A shrine maiden swordswoman in a torn white and crimson miko robe, long red hair rising like flames, holding a katana wreathed in fire, a translucent fox-shaped flame spirit coiling behind her, ash drifting around. Accent color: crimson-orange fire.
```

### leviaru — リヴァイアル（深淵の海蛇）
```
A titanic abyssal sea serpent with deep navy scales and bioluminescent cyan fins, rows of needle teeth, two curved horns, eyes glowing blood red, seawater and dark mist pouring off its coils. Accent color: cyan bioluminescence.
```

### mare — 潮騎士マーレ（沈没王国の騎士）
```
A drowned knight in barnacle-crusted steel plate armor, a closed helm with a glowing aqua visor slit, tattered deep-blue cape, wielding a coral-encrusted trident, water endlessly dripping from the armor. Accent color: aqua.
```

### aquamira — アクアミラ（月光の水母）
```
A giant floating moon jellyfish, translucent bell glowing pale blue and silver with a faint crescent moon pattern inside, long trailing ribbon tentacles, two calm white eyes, droplets of light floating around it. Accent color: moonlight silver-blue.
```

### druida — ドルイダ（千年樹の翁）
```
An ancient treant golem: a hunched giant made of gnarled bark and mossy stone, a glowing green heart-knot in its chest, roots for feet, branches like antlers sprouting from its head, a long beard of hanging moss and vines. Accent color: spring green glow.
```

### mandra — マンドラゴア（絶叫の毒蘭）
```
A carnivorous orchid monster rooted in the ground, a huge magenta flower head with a screaming fanged maw in its center, six yellow eyes above the mouth, thorny vine arms, dripping violet poison and drifting toxic spores. Accent color: toxic magenta.
```

### silva — シルヴァディア（翠角の霊鹿）
```
A sacred spirit stag with pale ivory fur, enormous branching antlers made of glowing green crystal and living leaves, a mane of fern fronds, hooves leaving blooming flowers, ethereal green motes around it. Accent color: emerald glow.
```

### voltis — ヴォルティス（天穿つ雷鳥）
```
A great thunderbird with storm-gray and electric-yellow plumage, wings spread wide crackling with lightning arcs, a sharp crest of jagged feathers, glowing cyan eyes, small storm clouds forming under its wings. Accent color: electric yellow.
```

### galva — ガルヴァ・MkIII（雷動機兵）
```
An artificial war automaton built by a dark factory: gunmetal armor plates, exposed copper coils and Tesla vents, a single glowing yellow visor eye, an oversized electrified gauntlet on one arm, faint factory serial numbers stenciled on the plating. Accent color: electric yellow.
```

### raika — 紫電狐ライカ（九尾の雷狐）
```
A sly nine-tailed fox with pale lavender fur, each of its nine tails tipped with violet lightning, long tall ears, a mischievous smirk with glowing magenta eyes, purple sparks dancing over its back. Accent color: violet lightning.
```

### frostheim — フロストヘイム（永久凍土の竜）
```
A massive ice dragon with frost-white and glacier-blue scales, jagged ice crystals growing along its spine and wings, frozen breath mist, three backswept horns of clear ice, dark void-blue eyes. Accent color: glacial blue.
```

### setsuna — 雪華姫セツナ（六花の剣舞姫）
```
An elegant swordswoman in a white and indigo kimono-style armor, long silver-white hair, wielding twin thin blades of ice, snowflake-shaped hexagonal crystals orbiting her, mid dance-like stance. Accent color: icy cyan.
```

### crystalos — クリスタロス（氷晶の要塞獣）
```
A fortress-like quadruped golem made of frozen steel and huge translucent ice crystal formations growing from its back and shoulders, a glowing blue core inside its chest, slow and immovable. Accent color: pale cyan.
```

### legion — アイアン・レギオン（不壊の重装兵）
```
A towering knight formed from the fused armor of a thousand fallen soldiers, mismatched dented plates, broken spears and arrows stuck in it, horned great helm with a red glowing slit, gripping a colossal greatsword, tattered dark-red banner cape. Accent color: blood red.
```

### zanba — 剣鬼ザンバ（百人斬りの浪人）
```
A cursed ronin swordsman in a tattered dark kimono and wide straw hat, face hidden in shadow except for glowing red eyes, holding a demonic katana leaking violet smoke, ghostly faces of his victims swirling around the blade. Accent color: violet.
```

### abyss — アビス・アイ（深淵の観測者）
```
A floating giant eyeball monster with a bloodshot iris of magenta, surrounded by orbiting black rune rings, dark tendrils hanging beneath, a membrane of shadow around the sclera, cosmic void particles. Accent color: magenta.
```

### necros — ネクロス（屍骨の炎竜）
```
A skeletal undead dragon of bleached bones held together by ghostly green flame, tattered membrane wings, ribcage burning with emerald fire, empty eye sockets glowing green, chains hanging from its neck. Accent color: ghostly emerald fire.
```

### jester — ジェスター（嘲笑う影道化）
```
A sinister shadow jester with a cracked white porcelain mask frozen in a wide grin, a three-pointed jester hat with bells, a body of living shadow in a harlequin coat, playing cards fanned between long clawed fingers. Accent color: hot pink.
```

### seraph — セラフィエル（雷翼の熾天使）
```
A six-winged seraph with white and gold feathers, a faceless golden mask with a single eye motif, a floating halo crackling with lightning, robes of light, holding no weapon. Accent color: golden light.
```

### arthur — 聖騎士アルトリウス（白銀の誓約騎士）
```
A noble paladin in ornate silver plate armor with gold filigree, royal-blue cape, plumed helm, wielding a radiant holy greatsword with light pouring from the blade, a heraldic shield on his back. Accent color: holy gold.
```

### kirin — 白麒麟（瑞祥の聖獣）
```
A holy qilin: a deer-dragon hybrid with ivory-white scales, a single golden horn, cloud-like wisps for mane and tail, hooves that float above the ground on mist, a serene but powerful look. Accent color: jade and gold.
```

### gorgo — ゴルゴニア（石化の蛇女王）
```
A serpent queen with an emerald cobra hood, the hood decorated with gem-like golden eye markings, coiling scaled body, hypnotic glowing golden eyes, a jeweled crown, stone fragments scattered around her. Accent color: golden yellow.
```

### brute — ベヒモス（大地喰らい）
```
A gigantic tusked behemoth, a mountain of brown hide and muscle with rocks and moss embedded in its back, two huge curved horns, a club-like tail, tiny furious red eyes, ground cracking under its weight. Accent color: amber.
```

### phoenix — フェニクシア（不死の焔鳥）
```
An immortal phoenix with feathers of flowing flame in red, orange and gold, long elegant tail plumes like fire ribbons, ash and embers falling from its wings, a calm luminous gaze. Accent color: golden fire.
```

### kraken — クラーケン（海魔の暴君）
```
A colossal kraken with dark crimson mottled skin, a huge bulbous head with furious yellow eyes and heavy brows, many thick tentacles with glowing orange suckers, wrecked ship timber tangled in its arms. Accent color: orange.
```

### moth — ルナモス（紅月の蛾）
```
A giant moth with blood-red wings patterned with eye-spots and crescent moons, feathery antennae, a fuzzy dark body, scales falling like red glowing dust, eerie pale eyes. Accent color: blood red.
```

## 伝説の魔獣（2体）

### chaostia — カオスティア（混沌の原初神）
```
A primordial god of chaos: a colossal white eye at the center of a body of swirling cosmic void, five rings of glowing runes orbiting it, a broken halo above, tendrils of starlight and darkness, half holy and half abyssal. Accent color: cyan and magenta.
```

### grimwald — グリムヴァルト（工廠長の切り札）
```
The ultimate artificial beast of a dark factory: a crowned colossus of blackened steel and furnace grates, a roaring blast-furnace heart, pipes and chains, a crown of iron spikes, red-hot glowing eyes, smoke billowing from its back. Accent color: furnace red.
```

---

## 背景（任意）

`assets/bg/arena.jpg` に置き、`manifest.js` の `bg` に `"arena"` を追加する。異変ごとの色合いはゲーム側が上から重ねる。

```
Wide 16:9 background illustration, 1920x1080, for a dark fantasy battle game. A circular stone arena floor in the foreground, viewed from a slight high angle, empty with no characters. Behind it, the silhouette of a huge industrial fortress-factory with chimneys, chains and faint warm window lights, under a night sky with a large moon. Japanese dark fantasy, ink-and-brush painterly style, muted palette. The lower half (arena floor) must be fairly plain and dark so characters stand out. No text.
```
