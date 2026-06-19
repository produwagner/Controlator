/* MÓDULO DE AUTENTICAÇÃO - GOOGLE OAUTH 2.0 (REESCRITO) */

// Chave padrão de demonstração compartilhada
export const DEFAULT_CLIENT_ID = '547096596172-fjrukqcnfb3abf833h3fb5uthpcunnv0.apps.googleusercontent.com';

let tokenClient = null;
let accessToken = null;
let tokenExpiresAt = 0;
let onAuthChangeCallback = null;

// Obter as credenciais salvas (Client ID padrão)
export function getSavedClientId() {
  return DEFAULT_CLIENT_ID;
}

export function saveClientId(newClientId) {
  // Como a configuração foi descontinuada, esta função limpa a chave
  localStorage.removeItem('controlator_client_id');
}

/**
 * Exibe uma mensagem de status/erro na tela de login
 * @param {string} message - Texto do aviso
 * @param {'error'|'warning'|'info'|'success'} type - Tipo do alerta
 */
export function showLoginStatus(message, type = 'error') {
  const msgEl = document.getElementById('login-status-msg');
  if (msgEl) {
    msgEl.className = `login-status-msg ${type}`;
    
    // Mapear ícones do Lucide
    let iconName = 'alert-circle';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'warning') iconName = 'alert-triangle';
    if (type === 'info') iconName = 'info';

    msgEl.innerHTML = `<i data-lucide="${iconName}"></i><span>${message}</span>`;
    msgEl.classList.remove('hidden');

    // Inicializar dinamicamente o ícone Lucide recém-inserido
    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons();
    }
  }
}

/**
 * Oculta a mensagem de status da tela de login
 */
export function hideLoginStatus() {
  const msgEl = document.getElementById('login-status-msg');
  if (msgEl) {
    msgEl.classList.add('hidden');
    msgEl.innerHTML = '';
  }
}

/**
 * Alterna o estado de carregamento do botão de login
 * @param {boolean} isLoading - Se está carregando ou não
 */
export function setLoginButtonLoading(isLoading) {
  const btn = document.getElementById('btn-login');
  const spinner = document.getElementById('btn-login-spinner');
  const icon = document.getElementById('btn-login-google-icon');
  const text = document.getElementById('btn-login-text');

  if (btn) {
    btn.disabled = isLoading;
  }

  if (spinner && icon && text) {
    if (isLoading) {
      spinner.classList.remove('hidden');
      icon.classList.add('hidden');
      text.textContent = 'Conectando...';
    } else {
      spinner.classList.add('hidden');
      icon.classList.remove('hidden');
      text.textContent = 'Entrar com Google';
    }
  }
}

/**
 * Inicializa o cliente Google Identity Services (GIS)
 * @param {Function} onStatusChange - Callback chamada quando o status de autenticação mudar
 */
export function initAuth(onStatusChange) {
  onAuthChangeCallback = onStatusChange;
  
  // Limpar qualquer resíduo do Client ID no localStorage
  localStorage.removeItem('controlator_client_id');
  
  // Tentar restaurar sessão existente do localStorage
  const savedToken = localStorage.getItem('controlator_access_token');
  const savedExpiresAt = localStorage.getItem('controlator_token_expires_at');
  const savedUser = localStorage.getItem('controlator_user_info');
  
  if (savedToken && savedExpiresAt && Number(savedExpiresAt) > Date.now()) {
    accessToken = savedToken;
    tokenExpiresAt = Number(savedExpiresAt);
    
    // Agendar logout quando o token expirar
    const msRemaining = tokenExpiresAt - Date.now();
    setTimeout(() => {
      logout();
    }, msRemaining);
    
    // Atualizar as informações do perfil em segundo plano para renovar o link da imagem
    fetchUserInfo(accessToken).then((userInfo) => {
      localStorage.setItem('controlator_user_info', JSON.stringify(userInfo));
    }).catch(err => {
      console.warn('Erro ao renovar foto do Google em segundo plano:', err);
    });

    if (onAuthChangeCallback) {
      onAuthChangeCallback(true, JSON.parse(savedUser));
    }
  } else {
    if (onAuthChangeCallback) {
      onAuthChangeCallback(false, null);
    }
  }

  // Inicializar o cliente OAuth do Google
  try {
    const clientId = getSavedClientId();
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
      callback: (tokenResponse) => {
        // Restaurar estado do botão
        setLoginButtonLoading(false);

        if (tokenResponse.error !== undefined) {
          console.error('Erro na autenticação Google:', tokenResponse);
          // Tratar erros conhecidos
          if (tokenResponse.error === 'popup_closed_by_user') {
            showLoginStatus('Login cancelado pelo usuário.', 'warning');
          } else if (tokenResponse.error === 'origin_mismatch') {
            showLoginStatus('Erro de origem: esta URL não está autorizada nas credenciais do Google Cloud.', 'error');
          } else if (tokenResponse.error === 'access_denied') {
            showLoginStatus('Acesso negado: o aplicativo precisa de permissões para funcionar.', 'error');
          } else {
            showLoginStatus('Erro ao autenticar: ' + (tokenResponse.error_description || tokenResponse.error), 'error');
          }
          return;
        }

        // Sucesso na autenticação
        accessToken = tokenResponse.access_token;
        const expiresInSeconds = Number(tokenResponse.expires_in);
        tokenExpiresAt = Date.now() + (expiresInSeconds * 1000);

        // Salvar no localStorage
        localStorage.setItem('controlator_access_token', accessToken);
        localStorage.setItem('controlator_token_expires_at', tokenExpiresAt);

        // Agendar expiração automática
        setTimeout(() => {
          logout();
        }, expiresInSeconds * 1000);

        // Ocultar avisos de status antigos
        hideLoginStatus();

        // Obter informações básicas do perfil do usuário usando a API UserInfo
        fetchUserInfo(accessToken).then((userInfo) => {
          localStorage.setItem('controlator_user_info', JSON.stringify(userInfo));
          if (onAuthChangeCallback) {
            onAuthChangeCallback(true, userInfo);
          }
        });
      },
    });
    console.log('Google Identity Services inicializado com sucesso.');
  } catch (err) {
    console.error('Falha ao inicializar Google Identity Services Client:', err);
    tokenClient = null;
  }
}

/**
 * Aguarda o SDK do Google estar pronto e dispara o fluxo de login
 */
export function login() {
  setLoginButtonLoading(true);
  hideLoginStatus();

  function tryLogin(attemptsLeft) {
    if (tokenClient) {
      // Solicitar token (abre popup do Google) sem forçar re-consentimento desnecessário
      try {
        tokenClient.requestAccessToken({ prompt: 'select_account' });
      } catch (err) {
        console.error('Erro ao chamar requestAccessToken:', err);
        setLoginButtonLoading(false);
        showLoginStatus('Erro ao iniciar o login: ' + err.message, 'error');
      }
      return;
    }

    // SDK ainda não carregou — tentar inicializar
    if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
      initAuth(onAuthChangeCallback);
      if (tokenClient) {
        try {
          tokenClient.requestAccessToken({ prompt: 'select_account' });
        } catch (err) {
          console.error('Erro ao chamar requestAccessToken pós-init:', err);
          setLoginButtonLoading(false);
          showLoginStatus('Erro ao iniciar o login: ' + err.message, 'error');
        }
        return;
      }
    }

    if (attemptsLeft > 0) {
      if (attemptsLeft % 5 === 0) {
        showLoginStatus('Carregando serviços do Google...', 'info');
      }
      setTimeout(() => tryLogin(attemptsLeft - 1), 200);
    } else {
      setLoginButtonLoading(false);
      showLoginStatus('Não foi possível carregar os serviços do Google. Verifique sua conexão e tente novamente.', 'error');
    }
  }

  // Tenta por até 5 segundos (25 tentativas x 200ms)
  tryLogin(25);
}

/**
 * Remove a autenticação
 */
export function logout() {
  if (accessToken) {
    try {
      google.accounts.oauth2.revokeToken(accessToken, () => {
        console.log('Token revogado no Google.');
      });
    } catch (err) {
      console.warn('Não foi possível revogar o token no Google:', err);
    }
  }

  accessToken = null;
  tokenExpiresAt = 0;
  localStorage.removeItem('controlator_access_token');
  localStorage.removeItem('controlator_token_expires_at');
  localStorage.removeItem('controlator_user_info');
  localStorage.removeItem('controlator_custom_user_info');

  if (onAuthChangeCallback) {
    onAuthChangeCallback(false, null);
  }
}

/**
 * Retorna o token de acesso ativo ou null
 */
export function getAccessToken() {
  if (accessToken && tokenExpiresAt > Date.now()) {
    return accessToken;
  }
  return null;
}

export function isAuthenticated() {
  return getAccessToken() !== null;
}

/**
 * Busca info do usuário logado usando a API Oauth2 do Google
 */
async function fetchUserInfo(token) {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (response.ok) {
      const data = await response.json();
      return {
        name: data.given_name || data.name || 'Usuário',
        avatar: data.picture || ''
      };
    }
  } catch (err) {
    console.error('Erro ao buscar perfil do usuário no Google:', err);
  }
  return { name: 'Usuário', avatar: '' };
}
