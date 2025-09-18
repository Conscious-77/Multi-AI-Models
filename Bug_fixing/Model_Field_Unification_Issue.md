# 模型字段公用问题 (Model Field Unification Issue)

## 问题描述

在实现多模型支持时，发现不同AI模型的API接口使用不同的字段名称，这导致了前端和后端需要处理多种字段格式的复杂性。

## 具体问题

### 字段名称差异示例

| 功能 | Gemini API | GPT API | Claude API | 统一接口 |
|------|------------|---------|------------|----------|
| 附件字段 | `attached_files` | `attach_files` | `attachments` | `attached_files` |
| 内容字段 | `content` | `context` | `content` | `content` |
| 模型字段 | `model` | `model` | `model` | `model` |

### 当前问题
1. **前端需要适配多种字段格式**
2. **后端需要处理不同模型的字段转换**
3. **代码维护复杂，容易出错**
4. **新增模型时需要修改多处代码**

## 解决方案

### 方案1：统一字段接口 + 内部转换（推荐）

#### 实现方式
1. **前端统一使用一套字段名称**
2. **后端在调用具体API时进行字段转换**
3. **保持接口一致性，内部处理差异**

#### 优点
- ✅ 前端接口统一，易于维护
- ✅ 新增模型只需修改后端转换逻辑
- ✅ 用户体验一致
- ✅ 代码结构清晰

#### 缺点
- ❌ 后端需要实现字段转换逻辑
- ❌ 可能增加一些性能开销

### 方案2：动态字段映射

#### 实现方式
1. **定义字段映射配置**
2. **根据选择的模型动态选择字段名称**
3. **前端根据模型类型使用对应字段**

#### 优点
- ✅ 灵活性高
- ✅ 支持复杂的字段差异

#### 缺点
- ❌ 前端逻辑复杂
- ❌ 维护成本高
- ❌ 容易出错

### 方案3：保持现状（不推荐）

#### 当前状态
- 前端需要处理多种字段格式
- 后端需要适配不同模型
- 代码维护困难

## 推荐实施方案

### 第一阶段：统一基础字段
1. **附件字段**: 统一使用 `attached_files`
2. **内容字段**: 统一使用 `content`
3. **模型字段**: 保持 `model`

### 第二阶段：实现后端转换
1. **创建字段转换函数**
2. **在API调用前进行转换**
3. **添加转换日志便于调试**

### 第三阶段：测试验证
1. **测试所有模型的字段转换**
2. **验证前端接口一致性**
3. **性能测试和优化**

## 技术实现细节

### 字段转换函数示例
```javascript
function convertFieldsForModel(fields, targetModel) {
  const conversions = {
    'gemini': {
      attached_files: 'attached_files',
      content: 'content'
    },
    'gpt': {
      attached_files: 'attach_files',
      content: 'context'
    },
    'claude': {
      attached_files: 'attachments',
      content: 'content'
    }
  };
  
  const conversion = conversions[targetModel] || {};
  const converted = {};
  
  for (const [key, value] of Object.entries(fields)) {
    const newKey = conversion[key] || key;
    converted[newKey] = value;
  }
  
  return converted;
}
```

### 使用方式
```javascript
// 在API调用前转换字段
const convertedFields = convertFieldsForModel(requestFields, selectedModel);
const response = await callModelAPI(convertedFields);
```

## 影响范围

### 需要修改的文件
1. **后端**: `server.js` - 添加字段转换逻辑
2. **前端**: 统一字段名称使用
3. **测试**: 验证所有模型的字段转换

### 测试用例
1. **Gemini模型**: 验证 `attached_files` 和 `content` 字段
2. **GPT模型**: 验证 `attach_files` 和 `context` 字段转换
3. **Claude模型**: 验证 `attachments` 字段转换
4. **混合模型**: 验证在同一会话中切换模型的字段处理

## 风险评估

### 低风险
- 字段转换逻辑相对简单
- 不影响现有功能
- 可以逐步实施

### 中风险
- 需要测试所有模型的字段转换
- 可能影响文件上传功能
- 需要验证性能影响

### 缓解措施
1. **分阶段实施**
2. **充分测试**
3. **保留回退方案**
4. **监控性能指标**

## 后续计划

1. **优先级**: 中等（不影响核心功能）
2. **时间安排**: 在文件上传功能开发时一并实施
3. **依赖关系**: 需要先完成模型选择功能
4. **验收标准**: 所有模型使用统一字段接口，后端自动转换

## 相关文档

- [File_Upload_Feature_Missing.md](./File_Upload_Feature_Missing.md)
- [GPT5_Temperature_Parameter_Issue.md](./GPT5_Temperature_Parameter_Issue.md)

## 更新记录

- **2025-08-31**: 创建文档，记录模型字段公用问题和解决方案
- **讨论参与者**: 用户 + AI助手
- **状态**: 方案确定，待实施

