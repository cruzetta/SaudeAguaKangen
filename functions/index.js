const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });
const jwt = require('jsonwebtoken');

admin.initializeApp();
const db = admin.firestore();

// --- CONFIGURAÇÃO DE SEGURANÇA ---
// Defina o seu email e senha de admin nas variáveis de ambiente do Firebase.
// Execute estes comandos no seu terminal:
// firebase functions:config:set admin.email="seu-email@admin.com"
// firebase functions:config:set admin.password="SUA_SENHA_SECRETA_AQUI"
// firebase functions:config:set admin.jwt_secret="SUA_CHAVE_SECRETA_LONGA_E_DIFICIL"
const ADMIN_EMAIL = functions.config().admin.email;
const ADMIN_PASSWORD = functions.config().admin.password;
const JWT_SECRET = functions.config().admin.jwt_secret;

// Middleware para verificar o token JWT
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).send('Acesso não autorizado.');
    }
    const token = authHeader.split(' ')[1];
    try {
        jwt.verify(token, JWT_SECRET);
        next();
    } catch (error) {
        return res.status(403).send('Token inválido ou expirado.');
    }
};


// Função para criar o conteúdo inicial no banco de dados se ele não existir
const initializeContent = async () => {
    const contentRef = db.collection('siteContent').doc('home');
    const doc = await contentRef.get();
    if (!doc.exists) {
        console.log("Documento de conteúdo não encontrado, criando um novo...");
        await contentRef.set({
            benefits: [
                { title: "Hidratação Superior", text: "A água Kangen é micro-clusterizada, permitindo uma absorção até 6x mais rápida e eficiente pelas células do seu corpo." },
                { title: "Poder Antioxidante", text: "Combate os radicais livres, responsáveis pelo envelhecimento precoce e diversas doenças, com um alto ORP negativo." },
                { title: "pH Alcalino Balanceado", text: "Ajuda a equilibrar o pH do seu corpo, combatendo a acidez e promovendo um ambiente interno mais saudável e resistente." },
                { title: "Certificações Globais", text: "A única no mercado com selo de Ouro da WQA e certificações ISO, garantindo a máxima qualidade e segurança." }
            ],
            products: [
                { name: "Leveluk K8", description: "O modelo mais poderoso e inteligente. 8 placas de titânio para um poder antioxidante superior e tela touch screen." },
                { name: "SD501 Platinum", description: "O best-seller mundial. 7 placas de titânio, design moderno e alta performance para toda a família." },
                { name: "Anespa DX", description: "Transforme seu banho em uma experiência de spa. Remove 100% do cloro e mineraliza a água para uma pele e cabelo saudáveis." }
            ],
            testimonials: [
                { quote: "Desde que comecei a beber Água Kangen, minha energia e disposição mudaram completamente. Adeus enxaqueca e dores no corpo. Recomendo de olhos fechados!", author: "Maria S." },
                { quote: "Como atleta, a hidratação é fundamental. Com a Kangen, minha recuperação muscular é muito mais rápida e meu desempenho melhorou visivelmente. É outro nível!", author: "João P." },
                { quote: "Minha pele e cabelo nunca estiveram tão saudáveis. A ducha Anespa fez uma diferença incrível, e a água de beber melhorou minha digestão. Toda a família usa e ama.", author: "Ana L." }
            ]
        });
    }
};

exports.api = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        
        // Rota de Login
        if (req.path === '/login' && req.method === 'POST') {
            const { email, password } = req.body;
            if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
                const token = jwt.sign({ user: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
                return res.status(200).json({ message: 'Login bem-sucedido!', token });
            }
            return res.status(401).json({ message: 'Email ou senha incorretos.' });
        }
        
        // Rota para buscar o conteúdo (pública)
        if (req.path === '/content' && req.method === 'GET') {
            try {
                await initializeContent(); // Garante que o conteúdo existe
                const contentRef = db.collection('siteContent').doc('home');
                const doc = await contentRef.get();
                return res.status(200).json(doc.data());
            } catch (error) {
                console.error("Erro ao buscar conteúdo:", error);
                return res.status(500).json({ message: 'Erro ao buscar conteúdo.' });
            }
        }

        // Rota para atualizar o conteúdo (protegida)
        if (req.path === '/content' && req.method === 'POST') {
            return authenticate(req, res, async () => {
                try {
                    const newContent = req.body;
                    const contentRef = db.collection('siteContent').doc('home');
                    await contentRef.set(newContent, { merge: true });
                    return res.status(200).json({ message: 'Conteúdo atualizado com sucesso!' });
                } catch (error) {
                    console.error("Erro ao atualizar conteúdo:", error);
                    return res.status(500).json({ message: 'Erro ao salvar conteúdo.' });
                }
            });
        }

        // Rota para salvar leads do formulário de contato (pública)
        if (req.path === '/submitForm' && req.method === 'POST') {
            const { name, phone, city } = req.body;
            if (!name || !phone || !city) {
                return res.status(400).json({ message: 'Dados incompletos.' });
            }
            try {
                await db.collection('leads').add({
                    name, phone, city, timestamp: admin.firestore.FieldValue.serverTimestamp()
                });
                return res.status(200).json({ message: 'Dados recebidos com sucesso!' });
            } catch (error) {
                console.error("Erro ao salvar lead:", error);
                return res.status(500).json({ message: 'Erro ao processar sua solicitação.' });
            }
        }

        return res.status(404).send('Rota não encontrada.');
    });
});
