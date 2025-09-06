const CLIENT_ID =
  '965178402317-g9s5k0m51j4fgb2abb6751rh9h5h3vqr.apps.googleusercontent.com';

function handleCredentialResponse() {
  console.log('handleCredentialResponse');
}

window.onload = function () {
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse,
  });
  google.accounts.id.renderButton(document.getElementById('google-auth'), {
    theme: 'outline',
    size: 'large',
  });
  google.accounts.id.prompt();
};

