# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: course.spec.js >> 课程模块 >> 课程详情页显示封面、标题、价格、购买按钮
- Location: e2e/course.spec.js:59:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=立即购买')
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('text=立即购买')

```

```
Error: write EPIPE
```