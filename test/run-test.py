# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

from __future__ import print_function, absolute_import

import atexit
from concurrent.futures import ThreadPoolExecutor
import json
import os
import subprocess
import sys
import shutil
import tempfile

from tornado.ioloop import IOLoop
from notebook.notebookapp import NotebookApp
from traitlets import Bool, Unicode


HERE = os.path.dirname(__file__)


def run(nbapp):
    """Run the tests"""
    terminalsAvailable = nbapp.web_app.settings['terminals_available']
    # Compatibility with Notebook 4.2.
    token = getattr(nbapp, 'token', '')
    config = dict(baseUrl=nbapp.connection_url, token=token,
                  terminalsAvailable=str(terminalsAvailable),
                  foo='bar')

    print('\n\nNotebook config:')
    print(json.dumps(config))

    with open(os.path.join(HERE, 'build', 'injector.js'), 'w') as fid:
        fid.write("""
        var node = document.createElement('script');
        node.id = 'jupyter-config-data';
        node.type = 'application/json';
        node.textContent = '%s';
        document.body.appendChild(node);
        """ % json.dumps(config))

    cmd = ['karma', 'start'] + sys.argv[1:]
    shell = os.name == 'nt'
    return subprocess.check_output(cmd, shell=shell)


def create_notebook_dir():
    """Create a temporary directory with some file structure."""
    root_dir = tempfile.mkdtemp(prefix='mock_contents')
    os.mkdir(os.path.join(root_dir, 'src'))
    with open(os.path.join(root_dir, 'src', 'temp.txt'), 'w') as fid:
        fid.write('hello')
    atexit.register(lambda: shutil.rmtree(root_dir, True))
    return root_dir


class TestApp(NotebookApp):
    """A notebook app that supports a unit test."""

    open_browser = Bool(False)
    notebook_dir = Unicode(create_notebook_dir())
    allow_origin = Unicode('*')

    def start(self):
        pool = ThreadPoolExecutor(max_workers=1)
        future = pool.submit(run, self)
        IOLoop.current().add_future(future, self._on_run_end)
        super(TestApp, self).start()

    def _on_run_end(self, future):
        self.stop()
        sys.exit(future.result())


if __name__ == '__main__':
    TestApp.launch_instance()
