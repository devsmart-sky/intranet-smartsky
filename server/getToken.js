const nodemailer = require('nodemailer');
const open = require('open');
const readline = require('readline');

async function getOAuthToken() {
    // ⚠️ SUBSTITUA COM SUAS CREDENCIAIS DO AZURE
    const clientId = '39702520-5eb4-445c-9be1-d497f2f8edcc'; // ID do Aplicativo (cliente)
    const clientSecret = 'ff531760-3feb-4689-acd0-a4c1322f471b';
    const userEmail = 'ti@smartsky.tech';

    try {
        const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=http://localhost&response_mode=query&scope=https://graph.microsoft.com/Mail.Send%20offline_access`;
        
        console.log('Por favor, abra a URL abaixo no seu navegador e siga as instruções para autorizar o acesso:');
        console.log(url);
        
        // Abre a URL no seu navegador automaticamente
        try {
            await open(url);
        } catch (err) {
            console.warn('⚠️ Erro ao abrir o navegador automaticamente. Por favor, copie e cole a URL acima manualmente.');
        }

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const redirectUrl = await new Promise(resolve => {
            rl.question('\nApós autorizar, você será redirecionado para "http://127.0.0.1". Copie a URL completa da barra de endereço e cole-a aqui: ', (answer) => {
                rl.close();
                resolve(answer);
            });
        });

        const urlParams = new URLSearchParams(redirectUrl.split('?')[1]);
        const code = urlParams.get('code');

        if (!code) {
            console.error('❌ Erro: O código de autorização não foi encontrado na URL. Verifique as credenciais e tente novamente.');
            return;
        }

        console.log('\n✅ Código de autorização obtido. Solicitando os tokens...');
        
        const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: clientId,
                scope: 'https://graph.microsoft.com/Mail.Send offline_access',
                code: code,
                redirect_uri: 'http://127.0.0.1',
                grant_type: 'authorization_code',
                client_secret: clientSecret
            })
        });

        const data = await response.json();

        if (data.refresh_token) {
            console.log('\n🎉 SUCESSO! Refresh Token obtido com sucesso!');
            console.log('--------------------------------------------------');
            console.log('Seu Refresh Token:');
            console.log(data.refresh_token);
            console.log('--------------------------------------------------');
            console.log('\nCopie este token e adicione-o ao seu arquivo .env como OAUTH_REFRESH_TOKEN.');
        } else {
            console.error('❌ Erro ao obter tokens:', data);
        }

    } catch (error) {
        console.error('❌ Erro durante o processo de obtenção do token:', error);
    }
}

getOAuthToken().catch(console.error);