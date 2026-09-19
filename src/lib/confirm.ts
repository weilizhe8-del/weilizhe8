/** An accessible in-page confirmation, with cancel as the initial focus. */
export function requestConfirmation(message: string, action = '确认'): Promise<boolean> {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'desk-confirm';
    const title = document.createElement('h2'); title.textContent = '确认操作'; title.id = 'desk-confirm-title';
    dialog.setAttribute('aria-labelledby', title.id);
    const text = document.createElement('p'); text.textContent = message;
    const actions = document.createElement('div'); actions.className = 'desk-links';
    const cancel = document.createElement('button'); cancel.textContent = '取消'; cancel.className = 'secondary-action';
    const confirm = document.createElement('button'); confirm.textContent = action; confirm.className = 'primary-action';
    const finish = (result: boolean) => { dialog.close(); dialog.remove(); resolve(result); };
    cancel.addEventListener('click', () => finish(false)); confirm.addEventListener('click', () => finish(true));
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
    actions.append(cancel, confirm); dialog.append(title, text, actions); document.body.append(dialog);
    dialog.showModal(); cancel.focus();
  });
}
