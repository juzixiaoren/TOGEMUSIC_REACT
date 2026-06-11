# 05 前端路由与状态管理

## 1. 路由架构概述

本项目使用React Router v6进行路由管理，采用简单的扁平路由结构，主要分为登录页和主页两个页面。

**路由配置文件**: `frontend/src/router/routes.tsx`

## 2. 路由表

| 路径 | 组件 | 说明 | 访问权限 |
|------|------|------|----------|
| `/` | `LoginPage` | 登录页面 | 公开 |
| `/login` | `LoginPage` | 登录页面（别名） | 公开 |
| `/home` | `HomePage` | 主页面 | 需要登录 |

**路由配置代码**:
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

## 3. 页面组件详解

### 3.1 LoginPage (登录页面)

**文件位置**: `frontend/src/pages/LoginPage/LoginPage.tsx`

**功能**: 用户登录/注册页面，包含登录表单和注册表单的切换。

**组件结构**:
```
LoginPage
├── HeaderTop (头部导航)
└── content (内容区域)
    └── loginContent.glass (毛玻璃容器)
        ├── LoginContainer (登录表单) - 当isLoginVisible=true
        └── RegisterContainer (注册表单) - 当isLoginVisible=false
```

**状态管理**:
```typescript
const [isLoginVisible, setIsLoginVisible] = useState(true);  // 控制显示登录还是注册
```

**功能**:
- 登录/注册表单切换
- 毛玻璃UI效果
- 响应式布局

**依赖组件**:
- `HeaderTop`: `frontend/src/components/HeaderTop/HeaderTop.tsx`
- `LoginContainer`: `frontend/src/components/LoginComponents/LoginContainer.tsx`
- `RegisterContainer`: `frontend/src/components/RegisterComponents/RegisterContainer.tsx`

**代码位置**:
- 组件定义: 第7-22行
- 状态管理: 第8行
- 切换逻辑: 第9-11行

---

### 3.2 HomePage (主页面)

**文件位置**: `frontend/src/pages/HomePage/HomePage.tsx`

**功能**: 应用主页面，包含功能切换栏和各个功能模块。

**组件结构**:
```
HomePage
├── HeaderTop (头部导航，显示用户信息)
├── FeatureSwitchBar (功能切换栏)
└── SocketProvider (Socket连接)
    └── AudioProvider (音频播放)
        └── home-feature-panel.glass (功能面板)
            ├── UploadMusic (当activeFeature='upload')
            ├── PlaylistManager (当activeFeature='playlist')
            ├── MusicLogin (当activeFeature='music-login')
            └── PlayerPage (始终挂载，display控制显隐)
```

**状态管理**:
```typescript
const [activeFeature, setActiveFeature] = useState<FeatureKey>('upload');  // 当前激活功能
const userId = localStorage.getItem('userId') || "";  // 用户ID
const token = localStorage.getItem('token');  // 认证token
const isLoggedIn = Boolean(userId && token);  // 登录状态
```

**功能切换**:
- `upload`: 音乐上传
- `playlist`: 歌单管理
- `music-login`: 音乐平台登录
- `player`: 播放器

**登录保护**:
```typescript
useEffect(() => {
    if (!isLoggedIn) {
        setMessage('请重新登录', 'error');
        localStorage.clear();
        navigate('/login', { replace: true });
    }
}, [isLoggedIn, navigate, setMessage]);
```

**重要设计**:
- `PlayerPage`始终挂载（`display: contents`或`display: none`）
- 确保Socket事件监听不中断
- 实现切歌同步功能

**依赖组件**:
- `HeaderTop`: `frontend/src/components/HeaderTop/HeaderTop.tsx`
- `FeatureSwitchBar`: `frontend/src/components/FeatureSwitchBar/FeatureSwitchBar.tsx`
- `PlayerPage`: `frontend/src/components/PlayerPage/PlayerPage.tsx`
- `UploadMusic`: `frontend/src/components/UploadMusic/UploadMusic.tsx`
- `PlaylistManager`: `frontend/src/components/PlaylistManager/PlaylistManager.tsx`
- `MusicLogin`: `frontend/src/components/MusicLogin/MusicLogin.tsx`
- `AudioProvider`: `frontend/src/context/AudioContext.tsx`
- `SocketProvider`: `frontend/src/context/SocketContext.tsx`

**代码位置**:
- 组件定义: 第14-57行
- 登录状态检查: 第22-28行
- 功能切换: 第39行
- PlayerPage挂载: 第48-50行

## 4. Context层次结构

### 4.1 应用级Context

**文件位置**: `frontend/src/App.tsx`

```typescript
function App() {
  return (
    <main>
      <MessageProvider>
        <RouterProvider router={router} />
      </MessageProvider>
    </main>
  )
}
```

**Context层次**:
```
<MessageProvider>  // 全局消息
    <RouterProvider>  // 路由
        {/* 路由页面 */}
    </RouterProvider>
</MessageProvider>
```

### 4.2 页面级Context

**文件位置**: `frontend/src/pages/HomePage/HomePage.tsx`

```typescript
<SocketProvider>  // Socket连接
    <AudioProvider>  // 音频播放
        <div className="home-feature-panel glass">
            {/* 功能组件 */}
        </div>
    </AudioProvider>
</SocketProvider>
```

**完整Context层次**:
```
<MessageProvider>  // 应用级
    <RouterProvider>
        <HomePage>
            <SocketProvider>  // 页面级
                <AudioProvider>  // 页面级
                    <PlayerPage />
                    <UploadMusic />
                    <PlaylistManager />
                    <MusicLogin />
                </AudioProvider>
            </SocketProvider>
        </HomePage>
    </RouterProvider>
</MessageProvider>
```

## 5. 认证与授权

### 5.1 登录状态管理

**存储方式**: localStorage

**存储内容**:
- `token`: 认证令牌
- `userId`: 用户ID

**检查逻辑**:
```typescript
const userId = localStorage.getItem('userId') || "";
const token = localStorage.getItem('token');
const isLoggedIn = Boolean(userId && token);
```

### 5.2 路由守卫

**实现位置**: `frontend/src/pages/HomePage/HomePage.tsx`

```typescript
useEffect(() => {
    if (!isLoggedIn) {
        setMessage('请重新登录', 'error');
        localStorage.clear();
        navigate('/login', { replace: true });
    }
}, [isLoggedIn, navigate, setMessage]);
```

**特点**:
- 组件级路由守卫
- 未登录时重定向到登录页
- 清除本地存储
- 显示错误消息

### 5.3 Axios拦截器

**文件位置**: `frontend/src/main.tsx`

**功能**:
- 全局401错误处理
- 自动登出
- 重定向到登录页

**代码位置**: 第11-33行

## 6. 导航流程

### 6.1 登录流程

```
用户访问 / 或 /login
    ↓
LoginPage显示
    ↓
用户输入凭据
    ↓
POST /auth/login
    ↓
成功: 存储token和userId
    ↓
navigate('/home')
    ↓
HomePage加载
    ↓
检查登录状态
    ↓
显示功能页面
```

### 6.2 登出流程

```
用户点击登出
    ↓
清除localStorage
    ↓
触发app:logout事件
    ↓
AudioContext停止播放
    ↓
navigate('/login')
    ↓
LoginPage显示
```

### 6.3 强制登出流程

```
Axios拦截器捕获401
    ↓
触发app:logout事件
    ↓
清除localStorage
    ↓
重定向到/login
    ↓
LoginPage显示
```

## 7. 功能模块切换

### 7.1 FeatureSwitchBar组件

**文件位置**: `frontend/src/components/FeatureSwitchBar/FeatureSwitchBar.tsx`

**功能**: 顶部功能切换栏，控制显示哪个功能模块。

**类型定义**:
```typescript
export type FeatureKey = 'upload' | 'playlist' | 'music-login' | 'player';
```

**Props**:
```typescript
type FeatureSwitchBarProps = {
    selectedKey: FeatureKey;  // 当前选中功能
    onChange: (key: FeatureKey) => void;  // 切换回调
};
```

### 7.2 功能模块渲染

**条件渲染逻辑**:
```typescript
{activeFeature === 'upload' && <UploadMusic />}
{activeFeature === 'playlist' && <PlaylistManager />}
{activeFeature === 'music-login' && <MusicLogin />}
<div style={{ display: activeFeature === 'player' ? 'contents' : 'none' }}>
    <PlayerPage />
</div>
```

**PlayerPage特殊处理**:
- 始终挂载到DOM
- 使用CSS `display`控制显隐
- 保持Socket连接和事件监听
- 确保切歌同步功能正常

## 8. 样式架构

### 8.1 全局样式

**文件位置**: `frontend/src/index.css`

**包含**:
- CSS变量定义（浅色/深色模式）
- Tailwind指令导入
- 全局基础样式
- 自定义字体
- 全局工具类

### 8.2 深色模式系统

**实现方式**: CSS变量 + Tailwind CSS `darkMode: 'class'`

**核心文件**:
- `frontend/src/context/DarkModeContext.tsx` - 深色模式状态管理
- `frontend/tailwind.config.js` - Tailwind颜色令牌配置
- `frontend/src/index.css` - CSS变量定义

**工作原理**:
1. `DarkModeContext` 在 `<html>` 元素上添加/移除 `dark` 类
2. CSS变量根据 `.dark` 选择器自动切换值
3. Tailwind CSS令牌通过 `var(--color-xxx)` 引用CSS变量
4. 组件使用统一的Tailwind类名（如 `bg-surface`、`text-text-primary`）

**颜色令牌系统**:
```javascript
// tailwind.config.js 示例
colors: {
  surface: 'var(--color-surface)',
  'text-primary': 'var(--color-text-primary)',
  'surface-card': 'var(--color-surface-card)',
  'surface-elevated': 'var(--color-surface-elevated)',
  // ... 更多令牌
}
```

**三层表面令牌**:
1. `surface` → 主背景色
2. `surface-card` → 卡片背景
3. `surface-elevated` → 悬浮元素背景

### 8.3 组件样式

**组织方式**: 每个组件目录下独立的CSS文件

**示例**:
```
components/
├── PlayerPage/
│   ├── PlayerPage.tsx
│   └── PlayerPage.css
├── UploadMusic/
│   ├── UploadMusic.tsx
│   └── UploadMusic.css
└── MusicLogin/
    ├── MusicLogin.tsx
    └── MusicLogin.css
```

### 8.4 页面样式

**文件位置**:
- `frontend/src/pages/LoginPage/LoginPage.css`
- `frontend/src/pages/HomePage/HomePage.css`

## 9. 响应式设计

### 9.1 断点设置

```css
/* 移动端 */
@media (max-width: 768px) { ... }

/* 平板端 */
@media (min-width: 769px) and (max-width: 1024px) { ... }

/* 桌面端 */
@media (min-width: 1025px) { ... }
```

### 9.2 布局策略

- 使用Flexbox和Grid布局
- 百分比宽度
- 相对单位（rem、em）
- 媒体查询适配

## 10. 状态管理最佳实践

### 10.1 Context使用原则

1. **最小化Context范围**: 每个Context只管理相关状态
2. **避免过度嵌套**: 合理组织Context层次
3. **性能优化**: 使用`useMemo`和`useCallback`减少重渲染

### 10.2 本地状态管理

- 组件内部状态使用`useState`
- 复杂状态逻辑使用`useReducer`
- 副作用使用`useEffect`

### 10.3 全局状态管理

- 用户认证: localStorage
- 消息通知: MessageContext
- 音频播放: AudioContext
- Socket连接: SocketContext

## 11. 错误处理

### 11.1 路由错误

- 未登录访问受保护页面 → 重定向到登录页
- 无效路由 → 可配置404页面

### 11.2 网络错误

- Axios拦截器处理401 → 强制登出
- 其他HTTP错误 → 组件级处理

### 11.3 运行时错误

- React错误边界捕获
- 显示友好的错误信息

## 12. 性能优化

### 12.1 代码分割

- 路由级代码分割（可配置）
- 组件懒加载

### 12.2 状态优化

- 避免不必要的重渲染
- 使用`React.memo`优化子组件
- 合理使用`useMemo`和`useCallback`

### 12.3 网络优化

- 请求缓存
- 防抖和节流
- 并行请求

## 13. 代码位置快速索引

| 功能模块 | 文件路径 | 关键行号 |
|----------|----------|----------|
| 路由配置 | `frontend/src/router/routes.tsx` | 1-18 |
| 应用入口 | `frontend/src/main.tsx` | 1-39 |
| 根组件 | `frontend/src/App.tsx` | 1-15 |
| 登录页面 | `frontend/src/pages/LoginPage/LoginPage.tsx` | 1-22 |
| 主页面 | `frontend/src/pages/HomePage/HomePage.tsx` | 1-57 |
| 消息Context | `frontend/src/context/MessageContext.tsx` | 1-30 |
| 音频Context | `frontend/src/context/AudioContext.tsx` | 1-265 |
| Socket Context | `frontend/src/context/SocketContext.tsx` | 1-200 |
| 功能切换栏 | `frontend/src/components/FeatureSwitchBar/FeatureSwitchBar.tsx` | - |

## 14. 扩展指南

### 14.1 添加新路由

1. 在`routes.tsx`中添加路由配置
2. 创建对应的页面组件
3. 更新导航菜单（如需要）
4. 配置访问权限（如需要）

### 14.2 添加新功能模块

1. 创建组件目录和文件
2. 在`FeatureSwitchBar`中添加新功能类型
3. 在`HomePage`中添加条件渲染
4. 更新样式和布局

### 14.3 添加新Context

1. 创建Context文件
2. 定义接口和Provider
3. 在适当的组件层次中包裹Provider
4. 创建自定义Hook便于使用

---

**最后更新**: 2026-06-11  
**维护者**: AI Assistant  
**文档版本**: 1.1