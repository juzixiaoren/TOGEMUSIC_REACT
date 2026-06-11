# 04 前端组件文档

## 1. 技术栈概述

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.x | UI框架 |
| TypeScript | 5.x | 类型系统 |
| Vite | 5.x | 构建工具 |
| React Router | 6.x | 路由管理 |
| Axios | 1.x | HTTP客户端 |
| Socket.IO Client | 4.x | WebSocket通信 |
| music-metadata-browser | - | 音频元数据解析 |

## 2. 前端目录结构

```
frontend/
├── src/
│   ├── main.tsx                    # 应用入口，Axios拦截器
│   ├── App.tsx                     # 根组件，Context提供者
│   ├── index.css                   # 全局样式
│   ├── assets/                     # 静态资源
│   │   └── images/
│   ├── components/                 # 组件目录
│   │   ├── PlayerPage/             # 播放器页面
│   │   │   ├── PlayerPage.tsx      # 主播放页面
│   │   │   ├── PlayerPanel.tsx     # 播放控制面板
│   │   │   ├── PlaylistPanel.tsx   # 播放列表面板
│   │   │   ├── DrawerSearchPanel.tsx # 搜索导入抽屉
│   │   │   ├── types.ts           # 类型定义
│   │   │   └── PlayerPage.css     # 样式
│   │   ├── PlaylistManager/        # 歌单管理
│   │   │   ├── PlaylistManager.tsx
│   │   │   └── types.ts
│   │   ├── UploadMusic/            # 音乐上传
│   │   │   ├── UploadMusic.tsx
│   │   │   ├── UploadDropzone.tsx
│   │   │   ├── UploadFileTable.tsx
│   │   │   ├── types.ts
│   │   │   └── UploadMusic.css
│   │   ├── MusicLogin/             # 音乐平台登录
│   │   │   ├── MusicLogin.tsx
│   │   │   └── MusicLogin.css
│   │   ├── OnlineUsers/            # 在线用户显示
│   │   │   ├── OnlineUsers.tsx
│   │   │   └── OnlineUsers.css
│   │   ├── MessageBox/             # 消息提示
│   │   │   └── MessageBox.tsx
│   │   └── ...
│   ├── context/                    # Context状态管理
│   │   ├── AudioContext.tsx         # 音频播放状态
│   │   ├── SocketContext.tsx        # Socket连接管理
│   │   └── MessageContext.tsx       # 全局消息
│   ├── pages/                      # 页面组件
│   │   ├── LoginPage/
│   │   └── HomePage/
│   └── router/                     # 路由配置
│       └── routes.tsx
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 3. 状态管理 (Context)

### 3.1 DarkModeContext

**文件位置**: `frontend/src/context/DarkModeContext.tsx`

**功能**: 深色模式状态管理，支持浅色/深色主题切换。

**接口定义**:
```typescript
interface DarkModeContextType {
    isDark: boolean;                    // 是否为深色模式
    toggleDarkMode: () => void;         // 切换深色模式
}
```

**使用方法**:
```typescript
const { isDark, toggleDarkMode } = useDarkMode();
```

**实现细节**:
- 初始状态从 `localStorage` 读取，若无则根据系统偏好自动设置
- 切换时在 `<html>` 元素上添加/移除 `dark` 类
- 状态持久化到 `localStorage`
- 通过 CSS 变量驱动所有颜色变化

**CSS变量驱动机制**:
```css
:root {
  --color-surface: #ffffff;
  --color-text-primary: #333333;
  /* ... 其他浅色变量 */
}

.dark {
  --color-surface: #1e1e2e;
  --color-text-primary: #e0e0e0;
  /* ... 其他深色变量 */
}
```

**Tailwind配置**:
```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: 'var(--color-surface)',
        'text-primary': 'var(--color-text-primary)',
        // ... 其他令牌
      }
    }
  }
}
```

**代码位置**:
- Context定义: 第4-9行
- Provider实现: 第28-50行
- useDarkMode Hook: 第12-18行
- 初始状态获取: 第20-26行

---

### 3.2 MessageContext

**文件位置**: `frontend/src/context/MessageContext.tsx`

**功能**: 全局消息通知系统，支持成功、错误、警告、信息四种类型。

**接口定义**:
```typescript
type MessageType = "success" | "error" | "warning" | "info";

interface MessageContextProps {
    setMessage: (message: string, type: MessageType) => void;
}
```

**使用方法**:
```typescript
const { setMessage } = useMessage();
setMessage('操作成功', 'success');
```

**实现细节**:
- 消息显示3秒后自动消失
- 使用`MessageBox`组件渲染
- 位置: `frontend/src/components/MessageBox/MessageBox.tsx`

**代码位置**:
- Context定义: 第4-8行
- Provider实现: 第16-30行
- useMessage Hook: 第9-15行

---

### 3.2 AudioContext

**文件位置**: `frontend/src/context/AudioContext.tsx`

**功能**: 音频播放状态管理，控制播放、暂停、音量、切歌等。

**接口定义**:
```typescript
interface AudioContextType {
    volume: number;                    // 音量 0-100
    isPlaying: boolean;                // 是否正在播放
    currentTime: number;               // 当前播放时间(秒)
    currentSongId: number | null;      // 当前歌曲ID
    playSong: (song: Song, offset?: number) => Promise<boolean>;  // 播放歌曲
    stopPlayback: () => void;          // 停止播放
    handleSetVolume: (newVolume: number) => void;  // 设置音量
    setOnEndedCallback: (callback: (() => void) | null) => void;  // 设置播放结束回调
    nextSong: () => void;              // 下一首
    prevSong: () => void;              // 上一首
    shufflePlaylist: () => void;       // 随机播放
}
```

**核心功能**:

1. **播放歌曲** (`playSong`):
   - 创建HTML5 Audio元素
   - 支持offset参数实现进度同步
   - 自动处理浏览器自动播放限制
   - 播放失败时添加点击解锁监听

2. **键盘快捷键**:
   - `PageDown` / `Numpad2`: 下一首
   - `PageUp` / `Numpad8`: 上一首
   - `Numpad5`: 随机播放
   - 输入框中不触发快捷键

3. **Socket集成**:
   - 通过`emitRequestNextSong`、`emitRequestPrevSong`、`emitRequestShuffle`发送切歌请求
   - 实现多客户端同步

4. **登出处理**:
   - 监听`app:logout`事件
   - 强制停止播放，避免路由切换竞态

**代码位置**:
- Context定义: 第7-19行
- Provider实现: 第31-265行
- 播放歌曲逻辑: 第100-167行
- 键盘快捷键: 第195-226行
- Socket集成: 第170-192行

---

### 3.3 SocketContext

**文件位置**: `frontend/src/context/SocketContext.tsx`

**功能**: Socket.IO连接管理，处理实时通信。

**接口定义**:
```typescript
interface SocketContextType {
    isConnected: boolean;              // 连接状态
    onlineUsers: OnlineUser[];         // 在线用户列表
    emitRequestNextSong: (callback?) => void;  // 请求下一首
    emitRequestPrevSong: (callback?) => void;  // 请求上一首
    emitRequestShuffle: (callback?) => void;   // 请求随机播放
    registerEventHandlers: (handlers: SocketEventHandlers) => void;  // 注册事件处理器
    unregisterEventHandlers: () => void;       // 注销事件处理器
}
```

**Socket事件类型**:

| 事件名 | 数据类型 | 方向 | 说明 |
|--------|----------|------|------|
| `song_changed` | `SongChangedData` | Server→Client | 歌曲切换 |
| `playlist_shuffled` | `PlaylistShuffledData` | Server→Client | 播放列表打乱 |
| `song_deleted_and_changed` | `SongDeletedAndChangedData` | Server→Client | 歌曲删除并切歌 |
| `playlist_updated` | `PlaylistUpdatedData` | Server→Client | 播放列表更新 |
| `sync_play_status` | `SyncPlayStatusData` | Server→Client | 同步播放状态 |
| `sync_playlist` | `SyncPlaylistData` | Server→Client | 同步播放列表 |
| `online_users_changed` | `OnlineUsersChangedData` | Server→Client | 在线用户列表更新 |
| `request_next_song` | - | Client→Server | 请求下一首 |
| `request_prev_song` | - | Client→Server | 请求上一首 |
| `request_shuffle_playlist` | - | Client→Server | 请求随机播放 |

**连接配置**:
- 开发环境直连后端: `http://hostname:8034`
- 生产环境使用相对路径: `/`
- 支持websocket和polling两种传输方式
- 自动重连，无限重试

**代码位置**:
- 事件数据类型定义: 第7-47行
- Context定义: 第49-56行
- Provider实现: 第68-200行
- Socket连接配置: 第75-91行
- 事件监听: 第131-159行

## 4. 核心组件详解

### 4.1 PlayerPage (主播放页面)

**文件位置**: `frontend/src/components/PlayerPage/PlayerPage.tsx`

**功能**: 播放器主页面，整合所有子组件，管理播放状态和Socket事件。

**状态管理**:
```typescript
// 播放列表相关
playlists: Playlist[]                    // 所有歌单列表
currentPlaylist: Song[]                  // 当前播放列表
allSongs: Song[]                         // 所有歌曲
playlistSongsMap: Record<number, Song[]> // 歌单歌曲缓存

// 播放状态
currentSong: Song | null                 // 当前播放歌曲
currentSongCoverUrl: string | null       // 当前歌曲封面URL
progressPercentage: number               // 播放进度百分比

// UI状态
drawerOpen: boolean                      // 抽屉是否打开
expandedPlaylist: number | null          // 展开的歌单ID
selectedSongs: number[]                  // 选中的歌曲ID列表
draggedIndex: number | null              // 拖拽中的索引
loading: boolean                         // 加载状态
```

**核心功能**:

1. **播放状态同步** (`checkAndSyncPlayStatus`):
   - 从后端获取当前播放状态
   - 计算播放偏移量
   - 同步本地播放器

2. **Socket事件处理**:
   - `onSongChanged`: 歌曲切换时更新播放器
   - `onPlaylistShuffled`: 播放列表打乱
   - `onSongDeletedAndChanged`: 歌曲删除并切歌
   - `onPlaylistUpdated`: 播放列表更新
   - `onSyncPlayStatus`: 初始状态同步
   - `onSyncPlaylist`: 初始列表同步

3. **播放列表管理**:
   - `loadDefaultPlaylist`: 加载默认播放列表(ID=1)
   - `loadPlaylists`: 加载所有歌单
   - `clearPlaylist`: 清空播放列表
   - `deleteSong`: 删除单首歌曲
   - `syncPlaylistOrder`: 同步播放列表顺序

4. **歌曲导入**:
   - `togglePlaylistExpand`: 展开/收起歌单
   - `selectAllFromPlaylist`: 全选歌单歌曲
   - `importSelectedSongs`: 导入选中歌曲

5. **封面获取** (`fetchSongCover`):
   - 优先从本地获取封面
   - QQ音乐歌曲回退到官方封面API

**子组件**:
- `PlayerPanel`: 播放控制面板
- `PlaylistPanel`: 播放列表面板
- `DrawerSearchPanel`: 搜索导入抽屉
- `OnlineUsers`: 在线用户显示

**代码位置**:
- 状态定义: 第34-48行
- 播放状态同步: 第333-358行
- Socket事件处理: 第409-496行
- 播放列表管理: 第184-284行
- 歌曲导入: 第312-330行
- 封面获取: 第100-136行

---

### 4.2 PlayerPanel (播放控制面板)

**文件位置**: `frontend/src/components/PlayerPage/PlayerPanel.tsx`

**功能**: 显示当前歌曲信息、封面、进度条、控制按钮。

**Props接口**:
```typescript
type PlayerPanelProps = {
    currentSong: Song | null;           // 当前歌曲
    currentSongCoverUrl: string | null; // 封面URL
    defaultCoverImage: string;          // 默认封面
    progressPercentage: number;         // 进度百分比
    currentTime: number;                // 当前时间
    volume: number;                     // 音量
    formatTime: (time: number) => string;  // 时间格式化函数
    onPrevSong: () => void;             // 上一首回调
    onNextSong: () => void;             // 下一首回调
    onShuffle: () => void;              // 随机播放回调
    onOpenImportDialog: () => void;     // 打开导入对话框
    onVolumeChange: (volume: number) => void;  // 音量变化回调
    onCoverLoadFailed: () => void;      // 封面加载失败回调
};
```

**UI结构**:
- 播放器头部标题
- 封面图片区域（支持加载失败回退）
- 歌曲信息（标题、艺术家）
- 进度条（带时间显示）
- 控制按钮（上一首、下一首）
- 音量控制滑块
- 额外功能按钮（随机播放、导入歌曲）

**代码位置**:
- Props定义: 第3-17行
- 组件实现: 第19-115行
- 封面显示逻辑: 第41-53行
- 进度条: 第69-79行
- 音量控制: 第90-103行

---

### 4.3 PlaylistPanel (播放列表面板)

**文件位置**: `frontend/src/components/PlayerPage/PlaylistPanel.tsx`

**功能**: 显示播放列表，支持拖拽排序、删除歌曲。

**Props接口**:
```typescript
type PlaylistPanelProps = {
    displayPlaylist: Song[];            // 显示的播放列表
    currentSongId: number | null;       // 当前播放歌曲ID
    formatTime: (time: number) => string;  // 时间格式化
    onPlay: () => void;                 // 播放回调
    onStopPlay: () => void;             // 停止回调
    onClear: () => void;                // 清空回调
    onDeleteSong: (songId: number) => void;  // 删除歌曲回调
    onDragStart: (index: number) => void;    // 拖拽开始
    onDragOver: (event: DragEvent) => void;  // 拖拽经过
    onDrop: (targetIndex: number) => void;   // 放置
    onDragEnd: () => void;              // 拖拽结束
};
```

**功能特性**:
- 显示歌曲列表（序号、标题、艺术家、时长）
- 当前播放歌曲高亮
- 拖拽排序（第一首歌不可拖拽）
- 删除单首歌曲
- 播放/暂停/清空控制按钮
- 空列表提示

**代码位置**:
- Props定义: 第4-16行
- 组件实现: 第18-83行
- 拖拽逻辑: 第49-53行
- 歌曲项渲染: 第43-73行

---

### 4.4 DrawerSearchPanel (搜索导入抽屉)

**文件位置**: `frontend/src/components/PlayerPage/DrawerSearchPanel.tsx`

**功能**: 侧边抽屉面板，支持歌单导入和在线搜索。

**Props接口**:
```typescript
type DrawerSearchPanelProps = {
    isOpen: boolean;                    // 是否打开
    onClose: () => void;                // 关闭回调
    playlists: Playlist[];              // 歌单列表
    allSongs: Song[];                   // 所有歌曲
    expandedPlaylist: number | null;    // 展开的歌单ID
    playlistSongsMap: Record<number, Song[]>;  // 歌单歌曲缓存
    selectedSongs: number[];            // 选中的歌曲ID
    onTogglePlaylistExpand: (playlistId: number) => void;  // 展开/收起
    onSelectAllFromPlaylist: (playlistId: number) => void;  // 全选
    onClearSelectionFromPlaylist: (playlistId: number) => void;  // 取消全选
    onToggleSong: (songId: number, checked: boolean) => void;   // 切换选中
    onImportSelectedSongs: () => void;  // 导入选中歌曲
    onSongImported: () => void;         // 歌曲导入完成回调
};
```

**三个Tab页**:

1. **歌单导入** (`playlists`):
   - 显示"所有歌曲"虚拟歌单
   - 显示所有用户歌单（排除默认歌单ID=1）
   - 支持展开/收起歌单
   - 支持全选/取消全选
   - 导入选中歌曲到播放列表

2. **QQ音乐搜索** (`qqmusic`):
   - 搜索框+搜索按钮
   - 搜索结果列表（标题、艺术家）
   - 检查歌曲是否已存在
   - 单首导入功能

3. **网易云搜索** (`netease`):
   - 同QQ音乐搜索功能
   - 不同的搜索API端点

**搜索结果标准化**:
- `normalizeQQSearchItems`: QQ音乐搜索结果标准化
- `normalizeNeteaseSearchItems`: 网易云搜索结果标准化

**代码位置**:
- 搜索结果类型: 第7-16行
- Props定义: 第20-34行
- QQ音乐标准化: 第37-70行
- 网易云标准化: 第73-84行
- 搜索功能: 第119-161行
- 导入功能: 第164-209行
- 歌单导入Tab: 第251-342行
- 搜索Tab: 第345-397行

---

### 4.5 OnlineUsers (在线用户显示)

**文件位置**: `frontend/src/components/OnlineUsers/OnlineUsers.tsx`

**功能**: 显示当前在线用户列表，支持随机颜色头像。

**Props接口**:
```typescript
interface OnlineUsersProps {
    users: OnlineUser[];  // 在线用户列表
}
```

**核心功能**:

1. **颜色生成** (`generateColorFromName`):
   - 根据用户名生成稳定的HSL颜色
   - 使用哈希算法确保同一用户名总是相同颜色
   - 颜色范围: HSL(0-360, 65%, 55%)

2. **首字符提取** (`getFirstChar`):
   - 支持中文和英文
   - 自动转换为大写
   - 空用户名显示'?'

3. **UI结构**:
   - 在线状态指示器（绿色/灰色圆点）
   - 在线人数统计
   - 用户头像网格（圆形头像 + 用户名）

**样式特性**:
- 头像: 40x40圆形，白色文字，悬停放大效果
- 用户名: 12px，超出隐藏，居中显示
- 响应式布局: flex-wrap自动换行

**代码位置**:
- 颜色生成: 第17-23行
- 首字符提取: 第28-31行
- 组件实现: 第34-72行

---

### 4.6 UploadMusic (音乐上传)

**文件位置**: `frontend/src/components/UploadMusic/UploadMusic.tsx`

**功能**: 音乐文件上传组件，支持分片上传和COS直传。

**核心常量**:
```typescript
const CHUNK_SIZE = 5 * 1024 * 1024;      // 分片大小 5MB
const MAX_CONCURRENT_CHUNKS = 3;         // 最大并发分片数
```

**状态管理**:
```typescript
files: UploadFileItem[]                  // 文件列表
uploading: boolean                       // 上传中状态
cosEnabled: boolean | null               // COS是否启用
playlists: PlaylistOption[]              // 歌单列表
selectedPlaylistId: number | ''          // 选中的歌单ID
newPlaylistName: string                  // 新歌单名称
creatingPlaylist: boolean                // 创建歌单中
```

**上传流程**:

1. **文件添加** (`addFiles`):
   - 过滤音频文件
   - 智能解析文件名（艺术家-标题）
   - 解析音乐元数据（使用music-metadata-browser）
   - 回退方案：使用Audio元素获取时长

2. **COS直传模式** (`uploadSingleFileCos`):
   - 从后端获取预签名URL
   - 提取封面图（Base64）
   - 使用XMLHttpRequest直传COS（带进度追踪）
   - 通知后端上传完成

3. **分片上传模式** (`uploadSingleFile`):
   - 初始化上传会话
   - 并发上传分片（最多3个）
   - 自动重试（最多3次）
   - 合并分片

4. **自动模式选择**:
   - 检测COS是否可用
   - 优先使用COS直传
   - 回退到分片上传

**歌单管理**:
- 加载现有歌单
- 创建新歌单
- 选择目标歌单

**代码位置**:
- 常量定义: 第10-11行
- 状态定义: 第20-27行
- 歌单加载: 第34-43行
- 歌单创建: 第50-67行
- 文件添加: 第144-182行
- 分片上传: 第184-223行
- COS上传: 第225-339行
- 分片上传入口: 第341-412行
- COS检测: 第414-430行
- 上传入口: 第432-468行

---

### 4.6 MusicLogin (音乐平台登录)

**文件位置**: `frontend/src/components/MusicLogin/MusicLogin.tsx`

**功能**: 多平台音乐登录管理，支持QQ音乐、网易云、酷狗。

**平台配置**:
```typescript
const platformConfig = {
    qqmusic: { name: 'QQ音乐', icon: '🎵', color: '#31c27c' },
    netease: { name: '网易云音乐', icon: '🎶', color: '#c20c0c' },
    kugou: { name: '酷狗音乐', icon: '🎤', color: '#2ca2c9' },
};
```

**状态管理**:
```typescript
activePlatform: Platform                 // 当前选中平台
platformCookieData: Record<Platform, PlatformCookieData>  // 各平台Cookie数据
loginStatus: LoginStatus                 // 登录状态
userPlaylists: UserPlaylist[]            // 用户歌单列表
playlistPage: number                     // 歌单分页
loading: boolean                         // 加载状态
loginLoading: boolean                    // 登录加载状态
systemLoggedIn: boolean                  // 系统登录状态
```

**核心功能**:

1. **Cookie池数据** (`fetchAllPlatformCookieData`):
   - 并行获取所有平台Cookie数据
   - 显示可用数量、VIP数量、非VIP数量

2. **登录流程**:
   - QQ音乐: 调用`/music-login/qqmusic/init`
   - 网易云: 调用`/music-login/netease/init`
   - 轮询登录状态（4秒间隔，5分钟超时）

3. **用户歌单**:
   - 获取用户歌单列表
   - 分页显示（每页9个）
   - 导入歌单到曲库

4. **退出登录**:
   - 调用退出API
   - 清除本地状态
   - 刷新Cookie数据

**UI结构**:
- 平台切换Tab
- Cookie池状态显示
- 系统登录提示
- 登录/退出按钮
- 用户歌单网格
- 功能说明

**代码位置**:
- 平台配置: 第29-33行
- 状态定义: 第37-48行
- Cookie数据获取: 第53-85行
- 登录状态获取: 第88-95行
- 用户歌单获取: 第98-111行
- QQ音乐登录: 第138-160行
- 网易云登录: 第163-185行
- 轮询逻辑: 第188-206行
- 退出登录: 第209-220行
- 歌单导入: 第223-266行

## 5. 类型定义

### 5.1 PlayerPage类型

**文件位置**: `frontend/src/components/PlayerPage/types.ts`

```typescript
export type Song = {
    id: number;              // 歌曲ID
    title: string;           // 标题
    artist: string;          // 艺术家
    duration: number;        // 时长(毫秒)
    file_extension: string;  // 文件扩展名
    file_path?: string;      // 文件路径
};

export type Playlist = {
    id: number;              // 歌单ID
    playlist_name: string;   // 歌单名称
};
```

### 5.2 Socket事件数据类型

**文件位置**: `frontend/src/context/SocketContext.tsx`

```typescript
// 歌曲切换
interface SongChangedData {
    new_song_id: number;
    current_song?: Song;
}

// 播放列表打乱
interface PlaylistShuffledData {
    songs: Song[];
}

// 歌曲删除并切歌
interface SongDeletedAndChangedData {
    deleted_song_id: number;
    new_song_id: number | null;
    new_song: Song | null;
    playlist: Song[];
}

// 播放列表更新
interface PlaylistUpdatedData {
    deleted_song_id: number;
    playlist: Song[];
}

// 同步播放状态
interface SyncPlayStatusData {
    is_playing: boolean;
    current_song: Song | null;
    play_start_time: string;
    server_now: number;
}

// 同步播放列表
interface SyncPlaylistData {
    songs: Song[];
}

// 在线用户
interface OnlineUser {
    user_id: number;
    username: string;
}

// 在线用户列表更新
interface OnlineUsersChangedData {
    users: OnlineUser[];
}
```

## 6. 路由配置

**文件位置**: `frontend/src/router/routes.tsx`

```typescript
import { createBrowserRouter } from "react-router-dom";
import LoginPage from "../pages/LoginPage/LoginPage";
import HomePage from "../pages/HomePage/HomePage";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <LoginPage />
    },
    {
        path: "/login",
        element: <LoginPage />
    },
    {
        path: "/home",
        element: <HomePage />
    }
]);
```

**路由说明**:
- `/` 和 `/login`: 登录页面
- `/home`: 主页面（需要登录）

## 7. Axios拦截器

**文件位置**: `frontend/src/main.tsx`

**配置**:
```typescript
axios.defaults.baseURL = '/api';
```

**拦截器逻辑**:
1. 捕获401错误
2. 检查本地token存在
3. 防止重复处理（`isHandlingUnauthorized`锁）
4. 触发`app:logout`事件
5. 清除localStorage
6. 重定向到登录页

**代码位置**:
- 基础URL配置: 第7行
- 拦截器实现: 第11-33行

## 8. 应用入口

### 8.1 main.tsx

**文件位置**: `frontend/src/main.tsx`

**功能**:
- 配置Axios拦截器
- 渲染根组件
- 开发环境禁用StrictMode

### 8.2 App.tsx

**文件位置**: `frontend/src/App.tsx`

**功能**:
- 包裹DarkModeProvider和MessageProvider
- 配置RouterProvider
- 渲染深色模式切换按钮

**Context层次**:
```
<DarkModeProvider>
    <MessageProvider>
        <RouterProvider>
            {/* 路由页面 */}
        </RouterProvider>
    </MessageProvider>
    <DarkModeToggle />
</DarkModeProvider>
```

## 9. 组件调用关系图

```
App.tsx
├── DarkModeProvider (context/DarkModeContext.tsx)
│   ├── MessageProvider (context/MessageContext.tsx)
│   │   └── RouterProvider (router/routes.tsx)
│   │       ├── LoginPage (pages/LoginPage/)
│   │       └── HomePage (pages/HomePage/)
│   │           └── PlayerPage (components/PlayerPage/)
│   │               ├── AudioProvider (context/AudioContext.tsx)
│   │               │   └── SocketProvider (context/SocketContext.tsx)
│   │               │       └── PlayerPage组件
│   │               ├── PlayerPanel (播放控制)
│   │               ├── PlaylistPanel (播放列表)
│   │               ├── OnlineUsers (在线用户显示)
│   │               └── DrawerSearchPanel (搜索导入)
│   │                   ├── 歌单导入Tab
│   │                   ├── QQ音乐搜索Tab
│   │                   └── 网易云搜索Tab
│   ├── UploadMusic (components/UploadMusic/)
│   │   ├── UploadDropzone (拖拽上传区)
│   │   └── UploadFileTable (文件列表)
│   └── MusicLogin (components/MusicLogin/)
└── DarkModeToggle (components/DarkModeToggle.tsx)
```

## 10. 数据流说明

### 10.1 播放流程

```
用户点击播放 → PlayerPage.startPlay()
    ↓
POST /requestplay (后端开始播放)
    ↓
等待500ms → checkAndSyncPlayStatus()
    ↓
GET /getplaystatus (获取播放状态)
    ↓
计算偏移量 → playWithOffset(song, offset)
    ↓
AudioContext.playSong() → 创建Audio元素
    ↓
HTML5 Audio播放 → 更新currentTime
```

### 10.2 Socket同步流程

```
后端播放状态变化
    ↓
Socket.IO发送事件 (song_changed等)
    ↓
SocketContext接收事件
    ↓
转发给注册的handler (PlayerPage)
    ↓
PlayerPage更新状态
    ↓
AudioContext播放新歌曲
    ↓
UI更新 (封面、进度、列表)
```

### 10.3 歌曲导入流程

```
DrawerSearchPanel搜索歌曲
    ↓
POST /qqmusic/import 或 /netease/import
    ↓
后端下载歌曲 → 保存到数据库
    ↓
POST /playlists/1/songs (添加到播放列表)
    ↓
onSongImported回调 → PlayerPage刷新数据
    ↓
更新currentPlaylist和allSongs
```

## 11. 代码位置快速索引

| 功能模块 | 文件路径 | 关键行号 |
|----------|----------|----------|
| 应用入口 | `frontend/src/main.tsx` | 1-39 |
| 根组件 | `frontend/src/App.tsx` | 1-21 |
| 路由配置 | `frontend/src/router/routes.tsx` | 1-18 |
| 深色模式Context | `frontend/src/context/DarkModeContext.tsx` | 1-51 |
| 消息Context | `frontend/src/context/MessageContext.tsx` | 1-30 |
| 音频Context | `frontend/src/context/AudioContext.tsx` | 1-265 |
| Socket Context | `frontend/src/context/SocketContext.tsx` | 1-200 |
| 主播放页面 | `frontend/src/components/PlayerPage/PlayerPage.tsx` | 1-609 |
| 播放控制面板 | `frontend/src/components/PlayerPage/PlayerPanel.tsx` | 1-115 |
| 播放列表面板 | `frontend/src/components/PlayerPage/PlaylistPanel.tsx` | 1-83 |
| 搜索导入抽屉 | `frontend/src/components/PlayerPage/DrawerSearchPanel.tsx` | 1-401 |
| 在线用户显示 | `frontend/src/components/OnlineUsers/OnlineUsers.tsx` | 1-72 |
| 音乐上传 | `frontend/src/components/UploadMusic/UploadMusic.tsx` | 1-529 |
| 音乐登录 | `frontend/src/components/MusicLogin/MusicLogin.tsx` | 1-427 |
| 类型定义 | `frontend/src/components/PlayerPage/types.ts` | 1-13 |

---

**最后更新**: 2026-06-11  
**维护者**: AI Assistant  
**文档版本**: 1.1