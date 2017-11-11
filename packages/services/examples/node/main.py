# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

from __future__ import print_function, absolute_import

import atexit
from concurrent.futures import ThreadPoolExecutor
import json
import shutil
import subprocess
import sys
import tempfile

from notebook.notebookapp import NotebookApp
from tornado.ioloop import IOLoop
from traitlets import Bool, Unicode


def create_notebook_dir():
    """Create a temporary directory"""
    root_dir = tempfile.mkdtemp(prefix='mock_contents')
    atexit.register(lambda: shutil.rmtree(root_dir, True))
    return root_dir


def run(nbapp):
    """Run the example"""
    node_command = ['node', 'index.js', '--jupyter-config-data=./config.json']
    config = dict(baseUrl=nbapp.base_url)
    if nbapp.token:
        config['token'] = nbapp.token

    with open('config.json', 'w') as fid:
        json.dump(config, fid)

    print('*' * 60)
    print(' '.join(node_command))
    return subprocess.call(node_command)


class TestApp(NotebookApp):
    """A notebook app that runs a node example."""

    open_browser = Bool(False)
    notebook_dir = Unicode(create_notebook_dir())

    def start(self):
        pool = ThreadPoolExecutor(max_workers=1)
        future = pool.submit(run, self)
        ioloop = IOLoop.current()
        ioloop.add_future(future, self.stop)
        super(TestApp, self).start()

    def stop(self, future):
        NotebookApp.stop(self)
        sys.exit(future.result())


if __name__ == '__main__':
    TestApp.launch_instance()
