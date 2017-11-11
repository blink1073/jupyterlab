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
DEBUG = False


def create_notebook_dir():
    """Create a temporary directory with some file structure."""
    root_dir = tempfile.mkdtemp(prefix='mock_contents')
    os.mkdir(os.path.join(root_dir, 'src'))
    with open(os.path.join(root_dir, 'src', 'temp.txt'), 'w') as fid:
        fid.write('hello')
    atexit.register(lambda: shutil.rmtree(root_dir, True))
    return root_dir


def run(nbapp):
    """Run the integration test"""
    terminalsAvailable = nbapp.web_app.settings['terminals_available']
    token = getattr(nbapp, 'token', '')
    mocha = os.path.join(HERE, '..', 'node_modules', '.bin', '_mocha')
    cmd = ['node', mocha, '--timeout', '200000',
           '--retries', '2',
           'build/integration.js',
           '--jupyter-config-data=./build/config.json']
    if DEBUG:
        cmd = ['devtool', mocha, '-qc'] + cmd[1:]

    config = dict(baseUrl=nbapp.connection_url,
                  terminalsAvailable=str(terminalsAvailable))
    if token:
        config['token'] = nbapp.token

    with open('build/config.json', 'w') as fid:
        json.dump(config, fid)

    shell = os.name == 'nt'
    return subprocess.check_output(cmd, shell=shell)


class TestApp(NotebookApp):
    """A notebook app that runs a mocha test."""

    open_browser = Bool(False)
    notebook_dir = Unicode(create_notebook_dir())

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
