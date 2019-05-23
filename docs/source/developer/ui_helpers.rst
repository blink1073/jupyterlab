User Interface Helpers
----------------------

JupyterLab comes with helpers to show or request simple information to user.
Those speed up development and ensure a common look & feel.

Dialogs
~~~~~~~

File Dialogs
''''''''''''

Two helper functions to ask a user to open a file or a directory are 
available in the ``filebrowser`` package under the namespace ``FileDialog``.

Here is an example to request a file.

.. code:: typescript

    const dialog = FileDialog.getExistingDirectory({
      manager, // IDocumentManager
      filter: model => model.type == 'notebook' // optional (model: Contents.IModel) => boolean
    });

    const result = await dialog;

    if(result.button.accept){
      let files = result.value;
    }


And for a folder.

.. code:: typescript

    const dialog = FileDialog.getExistingDirectory({
      manager // IDocumentManager
    });

    const result = await dialog;

    if(result.button.accept){
      let folders = result.value;
    }

.. note:: The document manager can be obtained in a plugin by requesting 
    ``IFileBrowserFactory`` service. The manager will be accessed through
    ``factory.defaultBrowser.model.manager``.
