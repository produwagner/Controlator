/* MÓDULO DE INTELIGÊNCIA ARTIFICIAL - EXTRAÇÃO DE DADOS COM GEMINI API & PDF.js */

/**
 * Salva a chave de API do Gemini no LocalStorage
 * @param {string} key 
 */
export function saveGeminiKey(key) {
  if (key) {
    localStorage.setItem('controlator_gemini_key', key.trim());
  } else {
    localStorage.removeItem('controlator_gemini_key');
  }
}

/**
 * Recupera a chave de API do Gemini salva no LocalStorage
 * @returns {string|null}
 */
export function getGeminiKey() {
  return localStorage.getItem('controlator_gemini_key');
}

/**
 * Extrai todo o texto contido em um arquivo PDF usando a biblioteca PDF.js
 * @param {File} file - Objeto de arquivo do input file
 * @returns {Promise<string>} O texto consolidado extraído do PDF
 */
export async function extrairTextoDoPDF(file) {
  return new Promise((resolve, reject) => {
    // Validar se o PDF.js está carregado
    if (typeof window === 'undefined' || !window.pdfjsLib) {
      reject(new Error('Biblioteca PDF.js não carregada. Verifique sua conexão com a internet.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = async function() {
      try {
        const arrayBuffer = this.result;
        
        // Inicializar leitura do documento (usando Uint8Array para ampla compatibilidade)
        const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await loadingTask.promise;
        let fullText = '';
        
        // Loop por cada uma das páginas para capturar as strings de texto
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          // Concatenar os trechos de strings em uma única linha
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
        }
        
        resolve(fullText);
      } catch (error) {
        console.error('Erro na extração do PDF.js:', error);
        reject(new Error('Falha ao processar e ler o arquivo PDF: ' + error.message));
      }
    };
    reader.onerror = function() {
      reject(new Error('Erro físico ao ler o arquivo selecionado.'));
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Envia o texto extraído da fatura para a API do Gemini processar estruturadamente em JSON
 * @param {string} textoPdf - Texto contido na fatura
 * @param {string} apiKey - Chave da API do Gemini
 * @returns {Promise<Array>} Lista de transações estruturadas
 */
export async function processarFaturaComGemini(textoPdf, apiKey) {
  if (!apiKey) {
    throw new Error('Chave de API do Gemini não configurada nos Ajustes.');
  }

  // URL do endpoint do Gemini 1.5 Flash (ótimo custo-benefício e multimodal/rápido)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  // Categorias válidas aceitas pela UI e Sheets
  const categoriasValidas = [
    'Alimentação',
    'Transporte',
    'Moradia',
    'Lazer',
    'Saúde',
    'Salário',
    'Rendimentos',
    'Investimento',
    'Outros'
  ];

  const anoAtual = new Date().getFullYear();

  // Instrução muito explícita para forçar um JSON Array puro
  const prompt = `Analise o texto a seguir extraído de uma fatura de cartão de crédito ou extrato bancário.
Extraia todas as transações individuais (compras, pagamentos, créditos, estornos) contidas nele.

Texto extraído da fatura:
---
${textoPdf}
---

Requisitos estritos de formatação:
1. Retorne o resultado estritamente como um JSON Array de objetos, sem tags de markdown, sem explicações e sem blocos de código (não use \`\`\`json ... \`\`\`).
2. Cada transação no array deve conter exatamente estas chaves:
   - "date": Data da transação em formato String "YYYY-MM-DD" (se o ano não estiver claro na fatura, use o ano atual: ${anoAtual}).
   - "description": Nome do estabelecimento comercial limpo e sem códigos de autenticação desnecessários.
   - "type": Deve ser exatamente "Despesa" (para compras, saídas, parcelas) ou "Receita" (para créditos, estornos, pagamentos da fatura).
   - "category": Sugira a categoria mais adequada para a transação. Ela DEVE ser uma destas e somente uma destas: ${categoriasValidas.map(c => `"${c}"`).join(', ')}. Use "Outros" se nenhuma for aplicável.
   - "value": Valor decimal positivo representando o preço/valor (ex: 49.90). Nunca insira valores negativos ou caracteres monetários (como R$).

Retorne apenas o JSON Array correspondente:`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const errMsg = errJson.error?.message || `Erro HTTP ${response.status}: ${response.statusText}`;
      
      // Capturar erro clássico de chave inválida
      if (response.status === 400 && errMsg.includes('API key')) {
        throw new Error('Chave de API do Gemini inválida ou bloqueada. Verifique suas configurações.');
      }
      throw new Error(errMsg);
    }

    const result = await response.json();
    const resultText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) {
      throw new Error('A API do Gemini retornou uma resposta em branco.');
    }

    // Limpar markdown code blocks (```json ... ```) caso a IA os inclua
    let cleanedText = resultText.trim();
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    }

    // Tentar fazer o parse do JSON retornado pela IA
    let transacoes = JSON.parse(cleanedText);
    
    // Se a IA retornar um objeto contendo o array (ex: { "transacoes": [...] }), extrair a lista
    if (!Array.isArray(transacoes) && typeof transacoes === 'object' && transacoes !== null) {
      const arrayKey = Object.keys(transacoes).find(k => Array.isArray(transacoes[k]));
      if (arrayKey) {
        transacoes = transacoes[arrayKey];
      }
    }

    if (!Array.isArray(transacoes)) {
      throw new Error('O resultado processado pela IA não está em formato de lista (Array).');
    }

    // Validar e higienizar campos retornados
    return transacoes.map(tx => {
      // Normalizar data (garantir YYYY-MM-DD válido)
      let finalDate = tx.date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(finalDate)) {
        finalDate = new Date().toISOString().split('T')[0];
      }

      // Normalizar tipo
      let finalType = tx.type;
      if (finalType !== 'Despesa' && finalType !== 'Receita') {
        finalType = 'Despesa'; // Padrão seguro
      }

      // Normalizar categoria
      let finalCategory = tx.category;
      if (!categoriasValidas.includes(finalCategory)) {
        finalCategory = 'Outros';
      }

      // Normalizar valor
      let finalValue = Number(tx.value);
      if (isNaN(finalValue) || finalValue <= 0) {
        finalValue = 0;
      }

      return {
        date: finalDate,
        description: (tx.description || 'Transação Importada').trim(),
        type: finalType,
        category: finalCategory,
        value: finalValue
      };
    }).filter(tx => tx.value > 0); // Ignorar transações de valor zero

  } catch (error) {
    console.error('Erro no processamento da IA:', error);
    throw new Error(error.message || 'Erro inesperado ao processar a fatura com o Gemini.');
  }
}
