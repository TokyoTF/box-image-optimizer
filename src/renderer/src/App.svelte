<script>
  import { files, listext } from './components/store'
  import { toasts, ToastContainer, FlatToast } from 'svelte-toasts'
  import { FileIcon, FolderIcon, ListXIcon, BoxSelectIcon } from 'lucide-svelte'
  import { onDestroy } from 'svelte'
  import filezie from 'file-size'
  let extsupport = ['png', 'jpg', 'webp', 'gif']
  let localfiles = []
  let localextfile = []
  let extinlist, currentext
  let savefolder = ''
  let compress = false
  let perCompress = 90
  let convert = false
  let selectedAll = true
  let forcereplace = false

  const OpenSingleFile = () => window.electron.ipcRenderer.send('Open:Folder:async', 'singlefile')
  const OpenFolder = () => window.electron.ipcRenderer.send('Open:Folder:async', 'folder')
  const SelectSaveFolder = () => window.electron.ipcRenderer.send('Select:Folder')
  const StartOptimizer = () => {
    if (compress || (convert && currentext && extinlist)) {
      $files.map((v) => (v.compress = false))
      window.electron.ipcRenderer.send('Start:Optimizer', {
        ofiles: localfiles.filter((v) => v.checked),
        compress,
        convert,
        perCompress,
        forcereplace
      })
      files.update((n) => (localfiles = n))
      toasts.info('Starting the process', { duration: 6500 })
    } else {
      console.log('err:', compress, convert, currentext, extinlist)
      toasts.error('A problem occurred in the process', { duration: 6500 })
    }
  }

  window.electron.ipcRenderer.on('Sync:process:finished', () => UpdateNotify())
  window.electron.ipcRenderer.on('Open:Folder:async', (event, args) => updatedata($files, args))
  window.electron.ipcRenderer.on('Select:Folder', (event, args) => UpdateSelectFolder(args))

  window.electron.ipcRenderer.on('Sync:process', (event, args) => updatestatus(args))

  function UpdateInputs(input, type) {
    if (type == 'compress') {
      compress = input.target.checked
    } else if (type == 'convert') {
      convert = input.target.checked
    } else if (type == 'percentageCompress') {
      perCompress = Number(input.target.value)
    }
  }

  function UpdateNotify() {
    toasts.success('The process is finished', { duration: 6500 })
  }

  function updateinputdata(input, index) {
    $files[index].checked = input.target.checked
    files.update((n) => (localfiles = n))
  }

  function changecheckedall() {
    $files.map((v) => (v.checked = selectedAll))
    files.update((n) => (localfiles = n))
  }

  function UpdateSelectFolder(folder) {
    savefolder = folder
  }

  function updateinputext(input) {
    extinlist = input.target.attributes['b'].value
    currentext = input.target.selectedOptions[0].value
    $files.map((v) => (v.ext == extinlist && v.checked ? (v.extchange = currentext) : ''))

    files.update((n) => (localfiles = n))
  }

  function updatestatus(args) {
    const newFile = $files.filter((v) => v.realpath == args.realpath)
    if (newFile.length) newFile[0].compress = args.compress
    files.update((n) => (localfiles = n))
  }

  function updatedata(filesAdd, args) {
    const newArt = args.filter((v) => {
      let art = $files.some((n) => n.realpath == v.realpath)

      if (!art && !localextfile.includes(v.ext)) {
        localextfile.push(v.ext)
      }

      return !art ? v : ''
    })

    filesAdd.push(...newArt)

    listext.update((n) => (localextfile = n))
    files.update((n) => (localfiles = n))
  }

  function calsize(size) {
    return filezie(size).human('si').toLowerCase()
  }

  const unsub = files.subscribe((v) => {
    localfiles = v
  })

  const unsubext = listext.subscribe((v) => {
    localextfile = v
  })

  const RemoveFile = (FileIndex) => {
    const newList = $files.filter((v, i) => i != FileIndex)
    $files = newList
    files.update((n) => (localfiles = n))
    if (!localfiles.length) {
      localextfile = []
    }
  }

  const CleanFiles = () => {
    localfiles = []
    $files = []
    compress = false
    convert = false
    if (!localfiles.length) {
      localextfile = []
    }
  }

  onDestroy(unsubext)
  onDestroy(unsub)
</script>

<main>
  <ToastContainer placement="bottom-right" let:data>
    <FlatToast {data} />
  </ToastContainer>
  <div class="warp-flex warp-list">
    <label for="opensinglefile" class="btn-ctn-style">
      <div class="btn-ctn-icon">
        <FileIcon size={20} />
      </div>
      <button id="opensinglefile" on:click={OpenSingleFile}>Open file</button>
    </label>
    <label for="openfolder" class="btn-ctn-style">
      <div class="btn-ctn-icon">
        <FolderIcon size={20} />
      </div>
      <button id="openfolder" on:click={OpenFolder}>Open folder</button>
    </label>
    {#if localfiles.length}
      <label for="selectedall" class="btn-ctn-style">
        <div class="btn-ctn-icon">
          <BoxSelectIcon size={20} />
        </div>
        <input
          type="checkbox"
          id="selectedall"
          bind:checked={selectedAll}
          on:change={changecheckedall}
        />
        {#if selectedAll}
          <p class="btn-ctn-style-p">Unselect All</p>
        {:else}
          <p class="btn-ctn-style-p">Select All</p>
        {/if}
      </label>
    {/if}
    <label for="cleanlist" class="btn-ctn-style">
      <div class="btn-ctn-icon">
        <ListXIcon size={20} />
      </div>
      <button id="cleanlist" on:click={CleanFiles}>Clear list</button>
    </label>
  </div>
  <div class="warp-flex warp-bt">
    <table>
      <thead>
        <th></th>
        <th>#</th>
        <th>name</th>
        <th>extension</th>
        <th>size</th>
        <th>process</th>
        <th></th>
      </thead>
      <tbody>
        {#if localfiles}
          {#each localfiles as file, index}
            <tr>
              <input
                type="checkbox"
                class="input-checkbox"
                on:change={(input) => updateinputdata(input, index)}
                name="statusfile"
                bind:checked={file.checked}
              />
              <td>{index}</td>
              <td class="nowarp" placeholder={file.name}>{file.name}</td>
              <td class="nowarp-line">{file.ext}</td>
              <td class="nowarp-line">{calsize(file.size)}</td>
              <td class="nowarp-line">{file.compress ? 'completed' : 'wait'}</td>
              <button on:click={() => RemoveFile(index)}>delete</button>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
    <div class="warp-column warp-flex right-menu">
      <label for="forcereplace" class="warp-flex gap-input">
        <input id="forcereplace" type="checkbox" name="forcereplace" bind:value={forcereplace} />
        <span class="input-title">Force replace already compressed image</span>
      </label>
      {#if localfiles.length}
        <label for="compress" class="warp-flex gap-input">
          <input
            id="compress"
            type="checkbox"
            name="compress"
            on:change={(e) => UpdateInputs(e, 'compress')}
          />
          <span class="input-title">compress</span>
        </label>
      {/if}
      {#if localfiles.length}
        <label for="convert" class="warp-flex gap-input">
          <input
            id="convert"
            type="checkbox"
            name="convert"
            on:change={(e) => UpdateInputs(e, 'convert')}
          />
          <span class="input-title">convert</span>
        </label>
      {/if}

      {#if compress && localfiles.length}
        <span class="subtitle">compress</span>
        <span class="subrange">Quality {perCompress}%</span>

        <input
          type="range"
          name="cc"
          id=""
          on:change={(e) => UpdateInputs(e, 'percentageCompress')}
          step={1}
          bind:value={perCompress}
          min={35}
          max={90}
        />
      {/if}

      {#if convert && localfiles.length}
        <span class="subtitle">convert</span>
        <div class="warp-flex center-inputs gap-input">
          <div class="warp-flex warp-column gap-input center-input">
            {#each localextfile as ext}
              <button disabled>{ext}</button>
            {/each}
          </div>
          to
          <div class="warp-flex warp-column gap-input center-input">
            {#each localextfile as _ext, index}
              <select
                name="toext"
                class="input-select-style"
                on:change={updateinputext}
                b={_ext}
                {index}
              >
                <option disabled selected>Select format</option>
                {#each extsupport as ext}
                  {#if _ext != ext}
                    <option value={ext}>{ext}</option>
                  {/if}
                {/each}
              </select>
            {/each}
          </div>
        </div>
      {/if}
      <span class="subtitle">Save Folder</span>
      <div class="warp-flex folder-save">
        <input type="text" name="savefolder" readonly bind:value={savefolder} />
        <button on:click={SelectSaveFolder}>
          <div class="btn-ctn-ricon">
            <FolderIcon size={20} />
          </div></button
        >
      </div>
      <div class="rspace"></div>
      {#if (compress || convert) && localfiles.length && savefolder}
        <button class="start-op" on:click={StartOptimizer}>Start</button>
      {:else}
        <button class="start-op" disabled on:click={StartOptimizer}>Start</button>
      {/if}
    </div>
  </div>
</main>
