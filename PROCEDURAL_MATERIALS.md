# 程序化材质维护说明

场景材质实现位于 `src/game/visuals/proceduralMaterials.ts`，连续噪点与固定种子实现位于 `src/game/core/proceduralNoise.ts`。所有纹理都由 CanvasTexture 在本地生成，不读取外部图片。

## 全局配置

`MATERIAL_RENDER_CONFIG` 提供以下入口：

- `enabled`：新旧视觉开关。设为 `false` 时使用低成本纯色回退纹理，不改变任何碰撞体。
- `quality`：`low`、`medium` 或 `high`。开启“减少特效”时，游戏自动使用 `medium`。
- `lightAngleDeg`：统一光照角，当前为左上方入射的 `135°`。
- `textureWorldSize`：纹理基准世界尺度，当前为 `12`。
- `maxPixelRatio`：程序化缓存允许的最大设备像素比，当前为 `2`。

各主题的基础色集中在 `THEME_COLORS`。材质内部亮度、高光、噪点和描边参数分别位于 `drawBrick`、`drawWood`、`drawFloor`、`drawMetal`、`drawGlass`、`drawSpikes`、`drawBlade` 和 `drawEnemy`。

## 缓存与一致性

- `ProceduralMaterialRenderer.renderMaterial` 是统一入口，输出 Phaser Texture key。
- 缓存键包含材质、尺寸、基础色、固定种子、质量级别和回退状态。
- 双人竞速中相同关卡的两套场景复用同一批 GPU 纹理。
- 噪点由关卡种子、对象 ID 和材质类型共同决定，暂停、重绘和再次进入时不会闪烁。
- 噪点按世界坐标采样。物体变大时会显示更多细节，而不是拉伸原纹理。
- 静态噪点只在首次创建 CanvasTexture 时计算，游戏更新循环不计算噪点。

## 材质分配

- 训练场薄平台：木材；厚地面：地砖。
- 霓虹楼顶：金属和地砖；ID 含 `glass` 的平台使用玻璃。
- 奥术熔炉：金属为主，符文平台为石材。
- 重力遗迹：石墙／石材。
- 移动平台和传送带始终使用金属材质。
- 尖刺和刀刃使用独立金属绘制，裂墙使用砖石，激光和力场使用能量材质。

新增对象时应继续通过 `createPlatformTexture`、`createHazardTexture` 或 `renderMaterial` 获取纹理，不要在游戏更新循环内创建 CanvasTexture。
