# coding: utf-8
"""A Jupyter-aware wrapper for the yarn package manager"""

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
import os
import sys
import subprocess
from hashlib import sha256

from logging import getLogger

from tornado.httpclient import HTTPClient

log = getLogger(__name__)


YARN_VERSION = '1.2.1'
YARN_FILE = 'yarn-{}.js'.format(YARN_VERSION)

# TODO: should this be in /share/jupyter/lab/vendor or something?
YARN_PATH = os.path.join(os.path.dirname(__file__), YARN_FILE)

# TODO: Or some other validation...
YARN_SHA256 = (
    'ae8e3e01f151161ec9cc5d5f887a7b3dbaa1e0119371bb6baa66a40b2233112b'
)

# TODO: should we provide fallbacks URLs?
YARN_URL = ('https://github.com/yarnpkg/yarn/releases/'
            'download/v{version}/{filename}'
            .format(version=YARN_VERSION,
                    filename=YARN_FILE))

# TODO: probably need to handle windows...
NODE = 'node'


def fetch():
    """
    Download a single-file release of the yarn javascript package manager
    """
    log.info('Downloading yarn (v%s) from: %s',
             YARN_VERSION,
             YARN_URL)

    response = HTTPClient().fetch(YARN_URL)

    log.info('Validating yarn...')

    if sha256(response.body).hexdigest() != YARN_SHA256:
        log.error('Downloaded yarn doesn\'t match expected:\n\t%s !=\t%s',
                  sha256(response.content).hexdigest(),
                  YARN_SHA256)
        return False

    log.info('Writing %s...', YARN_PATH)
    with open(YARN_PATH, 'wb') as fid:
        fid.write(response.body)

    return True


def yarn(yarn_args):
    return subprocess.Popen([NODE, YARN_PATH] + yarn_args).wait()


def main(argv=None):
    if not os.path.exists(YARN_PATH):
        if not fetch():
            sys.exit(1)

    sys.exit(yarn(argv if argv else sys.argv[1:]))
