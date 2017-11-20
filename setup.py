#!/usr/bin/env python
# coding: utf-8

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

from __future__ import print_function

#-----------------------------------------------------------------------------
# Minimal Python version sanity check
#-----------------------------------------------------------------------------

import sys

v = sys.version_info
if v[:2] < (2,7) or (v[0] >= 3 and v[:2] < (3,3)):
    error = "ERROR: %s requires Python version 2.7 or 3.3 or above." % name
    print(error, file=sys.stderr)
    sys.exit(1)

PY3 = (sys.version_info[0] >= 3)

#-----------------------------------------------------------------------------
# get on with it
#-----------------------------------------------------------------------------

from distutils import log
from hashlib import sha256
import json
import os
from glob import glob

try:
    from urllib2 import urlopen
except ImportError:
    from urllib.request import urlopen


# BEFORE importing distutils, remove MANIFEST. distutils doesn't properly
# update it when the contents of directories change.
if os.path.exists('MANIFEST'): os.remove('MANIFEST')

from distutils.command.build_ext import build_ext
from distutils.command.build_py import build_py
from setuptools.command.sdist import sdist
from setuptools import setup
from setuptools.command.bdist_egg import bdist_egg
from setuptools import setup
from setuptools.command.develop import develop


# Our own imports
from setupbase import (
    bdist_egg_disabled,
    find_packages,
    find_package_data,
    find_data_files,
    js_prerelease,
    CheckAssets,
    version_ns,
    name,
    custom_egg_info
)


here = os.path.dirname(os.path.abspath(__file__))
pjoin = os.path.join

DESCRIPTION = 'An alpha preview of the JupyterLab notebook server extension.'
LONG_DESCRIPTION = 'This is an alpha preview of JupyterLab. It is not ready for general usage yet. Development happens on https://github.com/jupyter/jupyterlab, with chat on https://gitter.im/jupyter/jupyterlab.'


class PostDevelopCommand(develop):
    """Post-installation for development mode."""

    def run(self):
        """Run the installation, then run jlpm to set up repo.
        """
        import subprocess
        develop.run(self)
        log.info('Running jlpm...')
        proc = subprocess.Popen('jlpm', cwd=here, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT)
        while proc.poll() is None:
            log.info(proc.stdout.readline().decode('utf-8'))


setup_args = dict(
    name             = name,
    description      = DESCRIPTION,
    long_description = LONG_DESCRIPTION,
    version          = version_ns['__version__'],
    scripts          = glob(pjoin('scripts', '*')),
    packages         = find_packages(),
    package_data     = find_package_data(),
    data_files       = find_data_files(),
    include_package_data = True,
    author           = 'Jupyter Development Team',
    author_email     = 'jupyter@googlegroups.com',
    url              = 'http://jupyter.org',
    license          = 'BSD',
    platforms        = "Linux, Mac OS X, Windows",
    keywords         = ['ipython', 'jupyter', 'Web'],
    classifiers      = [
        'Development Status :: 3 - Alpha',
        'Intended Audience :: Developers',
        'Intended Audience :: System Administrators',
        'Intended Audience :: Science/Research',
        'License :: OSI Approved :: BSD License',
        'Programming Language :: Python',
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.3',
        'Programming Language :: Python :: 3.4',
        'Programming Language :: Python :: 3.5',
    ],
)


cmdclass = dict(
    build_py = build_py,
    build_ext = build_ext,
    sdist  = js_prerelease(sdist, strict=True),
    bdist_egg = bdist_egg if 'bdist_egg' in sys.argv else bdist_egg_disabled,
    jsdeps = CheckAssets,
    egg_info = custom_egg_info,
    develop = PostDevelopCommand
)
try:
    from wheel.bdist_wheel import bdist_wheel
    cmdclass['bdist_wheel'] = js_prerelease(bdist_wheel, strict=True)
except ImportError:
    pass


setup_args['cmdclass'] = cmdclass


setuptools_args = {}
install_requires = setuptools_args['install_requires'] = [
    'notebook>=4.3.1',
    'jupyterlab_launcher>=0.5.2,<0.6.0',
    'ipython_genutils',
    "futures;python_version<'3.0'",
    "subprocess32;python_version<'3.0'"
]

extras_require = setuptools_args['extras_require'] = {
    'test:python_version == "2.7"': ['mock'],
    'test': ['pytest', 'requests', 'pytest-check-links', 'selenium'],
    'docs': [
        'sphinx',
        'recommonmark',
        'sphinx_rtd_theme'
    ],
}


if 'setuptools' in sys.modules:
    setup_args.update(setuptools_args)

    # force entrypoints with setuptools (needed for Windows, unconditional because of wheels)
    setup_args['entry_points'] = {
        'console_scripts': [
            'jupyter-lab = jupyterlab.labapp:main',
            'jupyter-labextension = jupyterlab.labextensions:main',
            'jupyter-labhub = jupyterlab.labhubapp:main',
            'jlpm = jupyterlab.jlpmapp:main',
        ]
    }
    setup_args.pop('scripts', None)

    setup_args.update(setuptools_args)

if __name__ == '__main__':
    setup(**setup_args)
