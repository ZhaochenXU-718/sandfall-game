# ART-A01：首页视觉方向稿

状态：已完成三套候选图；`ART-A02` 已选择 C「霓虹像素沙」作为主方向。

生成方式：Codex 内置 ImageGen（GPT-Image-2 路径）。

## 共同约束

```text
Use case: ui-mockup
Asset type: portrait mobile game home-screen visual direction concept
Primary request: Create a polished 9:16 mobile home screen visual direction for an original falling-sand puzzle game named SANDFALL. This is a controlled visual-direction comparison, not a screenshot of an existing product.
Structure: preserve this exact vertical hierarchy: top 7% empty safe area; compact brand area with title "SANDFALL" and no tagline; central floating hero made of four colorful sand-filled cubes with a few grains falling away; two equal side-by-side mode cards labeled "进阶模式" and "经典休闲"; one wide difficulty information panel; a small best-score line; one large primary start button labeled "开始游戏"; tiny footer hint. No navigation bar and no additional sections.
Color palette: near-black navy background; the same four core sand colors throughout: turquoise cyan, cobalt blue, coral red, warm golden yellow; optional purple only as a very small accent.
Composition/framing: straight-on portrait UI, centered, balanced, generous breathing room, readable at phone scale, top controls kept clear of notch and platform capsule areas.
Constraints: keep the interface practical and implementable in Cocos; keep the middle behind UI low-detail; no people, characters, ads, coins, store buttons, unrelated objects, third-party logos, trademarked game shapes, or watermark. Render requested text exactly once and no extra text.
```

## A：星砂玻璃

输出：[`../concepts/art-a01-direction-a-glass.png`](../concepts/art-a01-direction-a-glass.png)

```text
Style/medium: premium stylized 2.5D mobile game UI, luminous mineral glass and translucent colored sand, crisp production-ready interface, restrained depth, not photorealistic.
Lighting/mood: deep-ocean night atmosphere, soft aurora glow around the hero, elegant and calm with satisfying luminous accents.
Materials/textures: clear polished glass edges, densely packed fine sand inside cubes, subtle bloom, fine grain texture, clean dark panels.
```

评价：完成度和高级感最高，彩沙材质醒目；光效和背景细节需要在正式实装时收敛。

## B：柔体彩沙

输出：[`../concepts/art-a01-direction-b-clay.png`](../concepts/art-a01-direction-b-clay.png)

```text
Style/medium: friendly premium casual mobile game UI, tactile soft clay and rounded toy-like forms, fine colored sand with a matte velvety surface, subtle 2.5D depth, production-ready, not childish and not photorealistic.
Lighting/mood: quiet deep-night backdrop with warm soft studio lighting, cozy, approachable, satisfying, gentle glow rather than neon.
Materials/textures: matte clay frames, softly rounded sand blocks, tiny tactile grains, diffuse highlights, restrained shadows, clean dark panels.
Avoid: glass material and strong neon outlines.
```

评价：沙粒触感最直接、亲和力最好；厚重字体和玩具感需要适当减弱，避免年龄感偏低。

## C：霓虹像素沙

输出：[`../concepts/art-a01-direction-c-pixel.png`](../concepts/art-a01-direction-c-pixel.png)

```text
Style/medium: modern neon pixel-sand arcade UI, crisp geometric edges, tiny square-grain textures, restrained pixel-art influence combined with polished contemporary mobile interface, flat layered depth, production-ready, not retro low-resolution.
Lighting/mood: dark navy arcade atmosphere, energetic precise rim lights, controlled glow, fast and satisfying without visual clutter.
Materials/textures: compact square sand grains, dark graphite panels, thin luminous borders, scanline-like grain patterns used very subtly, sharp clean typography and controls.
Avoid: glass cubes, soft clay, imitation of any specific existing arcade game.
```

评价：玩法辨识度、信息清晰度和现有程序化沙粒的衔接最好；需要控制像素装饰密度，避免视觉噪声。

## ART-A02 选择建议

- 想要精致、高级、强调材质：选择 A。
- 想要轻松、亲和、强调触感：选择 B。
- 想要清晰、有节奏、强调玩法：选择 C。
- 可接受的混合方向：以 C 的结构和可读性为基础，吸收 A 的玻璃辉光与 B 的细沙触感，但只在选定单一主方向后再混合，避免三种材质同时竞争。

## ART-A02 最终决定

选择日期：2026-08-30

主方向：C「霓虹像素沙」。

后续设计约束：

- 保留 C 的深海夜色背景、像素颗粒材质、清晰信息层级和现代街机节奏。
- 彩沙继续使用青、蓝、红、黄四种核心色，第五色紫色只作为升级后的少量补充。
- 辉光保持克制，只在 Logo、选中状态、主按钮和消除反馈上使用。
- 可以少量吸收 A 的柔和辉光和高级感，但不使用大面积透明玻璃面板。
- 不引入 B 的黏土、毛毡、玩具塑料或厚重圆润字体。
- UI 不做复古低分辨率像素画；使用“现代清晰 UI + 像素沙粒细节”。
- 背景像素装饰保持低密度，确保模式说明、难度参数和最高分清晰可读。
- 正式资源不能照搬方向稿中的静态文字和数值，所有动态信息继续由 Cocos 渲染。
