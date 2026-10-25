// #TeriKolman66
import { writeFile } from 'node:fs/promises';

const targets = await fetch('http://127.0.0.1:9222/json/list').then((response) => response.json());
const target = targets.find((item) => item.url === 'http://127.0.0.1:1420/');
if (!target) throw new Error('Unfold browser target was not found');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let nextId = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
});

function cdp(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(selector, timeout = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error(`Timed out waiting for ${selector}`);
}

const setValue = (selector, value, index = 0) => evaluate(`(() => {
  const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
  const setter = Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set;
  setter.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
})()`);

await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await evaluate(`localStorage.clear(); location.reload()`);
await waitFor('.empty-state');
await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.includes('Create workspace')).click()`);
await waitFor('.modal');
await setValue('.form-stack input', 'Visual research');
await evaluate(`[...document.querySelectorAll('.modal button')].find((button) => button.textContent.includes('Create space')).click()`);
await waitFor('.quick-capture');

await evaluate(`[...document.querySelectorAll('.quick-capture button')].find((button) => button.textContent.includes('Note')).click()`);
await waitFor('.thought-node.note');
await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await waitFor('[data-clue-note]');
await setValue('.panel-scroll textarea', 'Key reference', 0);
await setValue('.panel-scroll textarea', 'Keep the visual language quiet, dark, and direct.', 1);

await evaluate(`(() => {
  if (!window.__unfoldOriginalInputClick) window.__unfoldOriginalInputClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function() {
    if (this.type !== 'file') return window.__unfoldOriginalInputClick.call(this);
    const transfer = new DataTransfer();
    if (this.accept.includes('image')) {
      transfer.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#111"/><circle cx="320" cy="200" r="110" fill="#444"/></svg>'], 'reference.svg', { type: 'image/svg+xml' }));
    } else {
      transfer.items.add(new File(['Unfold attachment'], 'notes.txt', { type: 'text/plain' }));
    }
    this.files = transfer.files;
    this.dispatchEvent(new Event('change', { bubbles: true }));
  };
})()`);

await evaluate(`document.querySelector('.react-flow__pane').click()`);
await evaluate(`[...document.querySelectorAll('.quick-capture button')].find((button) => button.textContent.includes('Photo')).click()`);
await waitFor('.thought-node.image');
await new Promise((resolve) => setTimeout(resolve, 250));
await evaluate(`document.querySelector('.react-flow__pane').click()`);
await evaluate(`[...document.querySelectorAll('.quick-capture button')].find((button) => button.textContent.includes('File')).click()`);
await waitFor('.thought-node.file');
await new Promise((resolve) => setTimeout(resolve, 250));

await evaluate(`document.querySelector('.react-flow__pane').click()`);
await evaluate(`[...document.querySelectorAll('.canvas-bottom-center button')].find((button) => button.textContent.includes('Fit all')).click()`);
await new Promise((resolve) => setTimeout(resolve, 1400));

await evaluate(`document.activeElement?.blur(); document.querySelector('.thought-node.note').click()`);
await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
await evaluate(`document.querySelector('.thought-node.image').click()`);
await new Promise((resolve) => setTimeout(resolve, 800));

await evaluate(`document.querySelector('.thought-node.file').click()`);
await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await new Promise((resolve) => setTimeout(resolve, 120));
const enterFocusedNote = await evaluate(`document.activeElement?.hasAttribute('data-clue-note')`);
await evaluate(`document.activeElement?.blur(); document.querySelector('.thought-node.note').click()`);
const editorStayedOnFile = await evaluate(`document.querySelector('.panel-scroll textarea')?.value === 'notes.txt'`);
await evaluate(`document.querySelector('.thought-node.note').click()`);
const repeatedClickDeselected = await evaluate(`document.querySelectorAll('.thought-node.selected').length === 0`);

await evaluate(`document.querySelector('.react-flow__pane').click()`);
await evaluate(`[...document.querySelectorAll('.quick-capture button')].find((button) => button.textContent.includes('Note')).click()`);
await new Promise((resolve) => setTimeout(resolve, 120));
await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });

await evaluate(`document.querySelector('[aria-label="Unpin editor panel"]').click()`);
await new Promise((resolve) => setTimeout(resolve, 100));
const unpinnedPanelClosed = await evaluate(`!document.querySelector('.node-panel')`);
await evaluate(`document.querySelector('.thought-node.file').click()`);
const selectionDoesNotOpenPanel = await evaluate(`!document.querySelector('.node-panel')`);
await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await waitFor('.node-panel');
await new Promise((resolve) => setTimeout(resolve, 120));
const enterOpenedUnpinnedPanel = await evaluate(`document.activeElement?.hasAttribute('data-clue-note')`);
await evaluate(`document.activeElement?.blur(); document.querySelector('[aria-label="Pin panel"]').click()`);

const zoomBefore = await evaluate(`document.querySelector('.react-flow__viewport').style.transform`);
await evaluate(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp', bubbles: true }))`);
await new Promise((resolve) => setTimeout(resolve, 400));
const zoomAfter = await evaluate(`document.querySelector('.react-flow__viewport').style.transform`);

await evaluate(`document.querySelector('.react-flow__pane').click()`);
await evaluate(`[...document.querySelectorAll('.canvas-bottom-center button')].find((button) => button.textContent.includes('Fit all')).click()`);
await new Promise((resolve) => setTimeout(resolve, 1400));
const result = await evaluate(`({
  nodes: document.querySelectorAll('.thought-node').length,
  notes: document.querySelectorAll('.thought-node.note').length,
  images: document.querySelectorAll('.thought-node.image').length,
  files: document.querySelectorAll('.thought-node.file').length,
  edges: document.querySelectorAll('.react-flow__edge').length,
  enterFocusedNote: ${JSON.stringify(enterFocusedNote)},
  editorStayedOnFile: ${JSON.stringify(editorStayedOnFile)},
  repeatedClickDeselected: ${JSON.stringify(repeatedClickDeselected)},
  unpinnedPanelClosed: ${JSON.stringify(unpinnedPanelClosed)},
  selectionDoesNotOpenPanel: ${JSON.stringify(selectionDoesNotOpenPanel)},
  enterOpenedUnpinnedPanel: ${JSON.stringify(enterOpenedUnpinnedPanel)},
  keyboardZoomChanged: ${JSON.stringify(zoomBefore !== zoomAfter)},
  saved: document.querySelector('.save-state').textContent,
  hasAutomaticQuestions: document.body.textContent.includes('Suggest follow-up') || document.body.textContent.includes('Add task')
})`);
const snapshot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile('unfold-editor.png', Buffer.from(snapshot.data, 'base64'));
socket.close();

if (result.nodes !== 3 || result.notes !== 1 || result.images !== 1 || result.files !== 1) throw new Error(`Unexpected cards: ${JSON.stringify(result)}`);
if (result.edges !== 1) throw new Error(`Expected one manual connection, found ${result.edges}`);
if (!result.enterFocusedNote || !result.keyboardZoomChanged) throw new Error(`Keyboard workflow failed: ${JSON.stringify(result)}`);
if (!result.editorStayedOnFile || !result.repeatedClickDeselected) throw new Error(`Selection/editor separation failed: ${JSON.stringify(result)}`);
if (!result.unpinnedPanelClosed || !result.selectionDoesNotOpenPanel || !result.enterOpenedUnpinnedPanel) throw new Error(`Panel pin workflow failed: ${JSON.stringify(result)}`);
if (result.hasAutomaticQuestions) throw new Error('Automatic question/task UI is still visible');
if (result.saved !== 'Saved locally') throw new Error(`Expected autosave to finish, found ${result.saved}`);
console.log(JSON.stringify(result, null, 2));
