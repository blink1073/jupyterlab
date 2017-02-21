// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import expect = require('expect.js');

import {
  toArray
} from '@phosphor/algorithm';

import {
  KernelMessage, Kernel
} from '@jupyterlab/services';

import {
  CodeEditor, CodeEditorWidget
} from '../../../lib/codeeditor';

import {
  CodeMirrorEditor
} from '../../../lib/codemirror';

import {
  CompleterWidget, CompletionHandler, CompleterModel
} from '../../../lib/completer';


function createEditorWidget(): CodeEditorWidget {
  let model = new CodeEditor.Model();
  let factory = (options: CodeEditor.IOptions) => {
    return new CodeMirrorEditor(options);
  };
  return new CodeEditorWidget({ factory, model });
}


class TestCompleterModel extends CompleterModel {
  methods: string[] = [];

  createPatch(patch: string): CompleterWidget.IPatch {
    this.methods.push('createPatch');
    return super.createPatch(patch);
  }

  handleTextChange(change: CompleterWidget.ITextState): void {
    this.methods.push('handleTextChange');
    super.handleTextChange(change);
  }
}


class TestCompletionHandler extends CompletionHandler {
  methods: string[] = [];

  makeRequest(request: CodeEditor.IPosition): Promise<void> {
    let promise = super.makeRequest(request);
    this.methods.push('makeRequest');
    return promise;
  }

  onReply(pending: number, request: CompleterWidget.ITextState, msg: KernelMessage.ICompleteReplyMsg): void {
    super.onReply(pending, request, msg);
    this.methods.push('onReply');
  }

  onTextChanged(): void {
    super.onTextChanged();
    this.methods.push('onTextChanged');
  }

  onCompletionSelected(widget: CompleterWidget, value: string): void {
    super.onCompletionSelected(widget, value);
    this.methods.push('onCompletionSelected');
  }
}

const kernelPromise = Kernel.startNew();


describe('completer/handler', () => {

  let kernel: Kernel.IKernel;

  beforeEach((done) => {
    kernelPromise.then(k => {
      kernel = k;
      done();
    });
  });

  after(() => {
    kernel.shutdown();
  });

  describe('CompletionHandler', () => {

    describe('#constructor()', () => {

      it('should create a completer handler', () => {
        let handler = new CompletionHandler({
          completer: new CompleterWidget()
        });
        expect(handler).to.be.a(CompletionHandler);
      });

    });

    describe('#kernel', () => {

      it('should default to null', () => {
        let handler = new CompletionHandler({
          completer: new CompleterWidget()
        });
        expect(handler.kernel).to.be(null);
      });

      it('should be settable', () => {
        let handler = new CompletionHandler({
          completer: new CompleterWidget()
        });
        expect(handler.kernel).to.be(null);
        handler.kernel = kernel;
        expect(handler.kernel).to.be(kernel);
      });

    });


    describe('#editor', () => {

      it('should default to null', () => {
        let handler = new CompletionHandler({
          completer: new CompleterWidget()
        });
        expect(handler.editor).to.be(null);
      });

      it('should be settable', () => {
        let handler = new CompletionHandler({
          completer: new CompleterWidget()
        });
        let widget = createEditorWidget();
        expect(handler.editor).to.be(null);
        handler.editor = widget.editor;
        expect(handler.editor).to.be(widget.editor);
      });

      it('should be resettable', () => {
        let handler = new CompletionHandler({
          completer: new CompleterWidget()
        });
        let one = createEditorWidget();
        let two = createEditorWidget();
        expect(handler.editor).to.be(null);
        handler.editor = one.editor;
        expect(handler.editor).to.be(one.editor);
        handler.editor = two.editor;
        expect(handler.editor).to.be(two.editor);
      });

    });

    describe('#isDisposed', () => {

      it('should be true if handler has been disposed', () => {
        let handler = new CompletionHandler({
          completer: new CompleterWidget()
        });
        expect(handler.isDisposed).to.be(false);
        handler.dispose();
        expect(handler.isDisposed).to.be(true);
      });

    });

    describe('#dispose()', () => {

      it('should dispose of the handler resources', () => {
        let handler = new CompletionHandler({
          completer: new CompleterWidget(),
          kernel: kernel
        });
        expect(handler.isDisposed).to.be(false);
        expect(handler.kernel).to.be.ok();
        handler.dispose();
        expect(handler.isDisposed).to.be(true);
        expect(handler.kernel).to.not.be.ok();
      });

      it('should be safe to call multiple times', () => {
        let handler = new CompletionHandler({
          completer: new CompleterWidget()
        });
        expect(handler.isDisposed).to.be(false);
        handler.dispose();
        handler.dispose();
        expect(handler.isDisposed).to.be(true);
      });

    });

    describe('#makeRequest()', () => {

      it('should reject if handler has no kernel', (done) => {
        let handler = new TestCompletionHandler({
          completer: new CompleterWidget()
        });
        handler.editor = createEditorWidget().editor;
        let request = {
          column: 0,
          line: 0
        };
        handler.makeRequest(request).catch((reason: Error) => {
          expect(reason).to.be.an(Error);
          done();
        });
      });

      it('should reject if handler has no active cell', (done) => {
        let handler = new TestCompletionHandler({
          completer: new CompleterWidget()
        });
        handler.kernel = kernel;
        let request = {
          column: 0,
          line: 0
        };
        handler.makeRequest(request).catch((reason: Error) => {
          expect(reason).to.be.an(Error);
          done();
        });
      });

      it('should resolve if handler has a kernel and an active cell', (done) => {
        let handler = new TestCompletionHandler({
          completer: new CompleterWidget()
        });
        let request = {
          column: 0,
          line: 0
        };
        handler.kernel = kernel;
        handler.editor = createEditorWidget().editor;
        handler.editor.model.value.text = 'a=1';

        handler.makeRequest(request).then(() => { done(); }).catch(done);
      });

    });

    describe('#onReply()', () => {

      it('should do nothing if handler has been disposed', () => {
        let completer = new CompleterWidget();
        let handler = new TestCompletionHandler({ completer });
        completer.model = new CompleterModel();
        completer.model.setOptions(['foo', 'bar', 'baz']);
        handler.dispose();
        handler.onReply(0, null, null);
        expect(completer.model).to.be.ok();
      });

      it('should do nothing if pending request ID does not match', () => {
        let completer = new CompleterWidget();
        let handler = new TestCompletionHandler({ completer });
        completer.model = new CompleterModel();
        completer.model.setOptions(['foo', 'bar', 'baz']);
        handler.onReply(2, null, null);
        expect(completer.model).to.be.ok();
      });

      it('should reset model if status is not ok', () => {
        let completer = new CompleterWidget();
        let handler = new TestCompletionHandler({ completer });
        let options = ['a', 'b', 'c'];
        let request: CompleterWidget.ITextState = {
          column: 0,
          lineHeight: 0,
          charWidth: 0,
          line: 0,
          coords: null,
          text: 'f'
        };
        let reply: KernelMessage.ICompleteReplyMsg = {
          header: null,
          parent_header: {},
          metadata: {},
          buffers: null,
          channel: 'shell',
          content: {
            status: 'error',
            cursor_start: 0,
            cursor_end: 0,
            metadata: {},
            matches: ['foo']
          }
        };
        completer.model = new CompleterModel();
        completer.model.setOptions(options);
        expect(toArray(completer.model.options())).to.eql(options);
        handler.onReply(0, request, reply);
        expect(toArray(completer.model.options())).to.eql([]);
      });

      it('should update model if status is ok', () => {
        let completer = new CompleterWidget();
        let handler = new TestCompletionHandler({ completer });
        let options = ['a', 'b', 'c'];
        let request: CompleterWidget.ITextState = {
          column: 0,
          lineHeight: 0,
          charWidth: 0,
          line: 0,
          coords: null,
          text: 'f'
        };
        let reply: KernelMessage.ICompleteReplyMsg = {
          header: null,
          parent_header: {},
          metadata: {},
          buffers: null,
          channel: 'shell',
          content: {
            status: 'ok',
            cursor_start: 0,
            cursor_end: 0,
            metadata: {},
            matches: ['foo']
          }
        };
        completer.model = new CompleterModel();
        completer.model.setOptions(options);
        expect(toArray(completer.model.options())).to.eql(options);
        handler.onReply(0, request, reply);
        expect(toArray(completer.model.options())).to.eql(reply.content.matches);
      });

    });

    describe('#onTextChanged()', () => {

      it('should fire when the active editor emits a text change', () => {
        let handler = new TestCompletionHandler({
          completer: new CompleterWidget()
        });
        handler.editor = createEditorWidget().editor;
        expect(handler.methods).to.not.contain('onTextChanged');
        handler.editor.model.value.text = 'foo';
        expect(handler.methods).to.contain('onTextChanged');
      });

      it('should call model change handler if model exists', () => {
        let completer = new CompleterWidget({
          model: new TestCompleterModel()
        });
        let handler = new TestCompletionHandler({ completer });
        let editor = createEditorWidget().editor;
        let model = completer.model as TestCompleterModel;

        handler.editor = editor;
        expect(model.methods).to.not.contain('handleTextChange');
        editor.model.value.text = 'bar';
        editor.setCursorPosition({ line: 0, column: 2 });
        // This signal is emitted (again) because the cursor position that
        // a natural user would create need to be recreated here.
        editor.model.value.changed.emit(void 0);
        expect(model.methods).to.contain('handleTextChange');
      });

    });

    describe('#onCompletionSelected()', () => {

      it('should fire when the completer widget emits a signal', () => {
        let completer = new CompleterWidget();
        let handler = new TestCompletionHandler({ completer });

        expect(handler.methods).to.not.contain('onCompletionSelected');
        completer.selected.emit('foo');
        expect(handler.methods).to.contain('onCompletionSelected');
      });

      it('should call model create patch method if model exists', () => {
        let completer = new CompleterWidget({
          model: new TestCompleterModel()
        });
        let handler = new TestCompletionHandler({ completer });
        let model = completer.model as TestCompleterModel;

        handler.editor = createEditorWidget().editor;
        expect(model.methods).to.not.contain('createPatch');
        completer.selected.emit('foo');
        expect(model.methods).to.contain('createPatch');
      });

      it('should update cell if patch exists', () => {
        let model = new CompleterModel();
        let patch = 'foobar';
        let completer = new CompleterWidget({ model });
        let handler = new TestCompletionHandler({ completer });
        let editor = createEditorWidget().editor;
        let text = 'eggs\nfoo # comment\nbaz';
        let want = 'eggs\nfoobar # comment\nbaz';
        let request: CompleterWidget.ITextState = {
          column: 5,
          line: 1,
          lineHeight: 0,
          charWidth: 0,
          coords: null,
          text
        };

        handler.editor = editor;
        handler.editor.model.value.text = text;
        model.original = request;
        model.cursor = { start: 5, end: 8 };
        completer.selected.emit(patch);
        expect(handler.editor.model.value.text).to.equal(want);
      });

    });

  });

});
