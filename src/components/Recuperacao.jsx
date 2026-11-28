import { Component } from 'react';
import guiasHtml from '../editorial/guias.html?raw';

// Uma falha de uma aba não pode deixar o leitor em uma tela vazia.
export default class Recuperacao extends Component {
  state = { falhou: false };

  static getDerivedStateFromError() {
    return { falhou: true };
  }

  render() {
    if (!this.state.falhou) return this.props.children;
    return (
      <main className="jornal max-w-4xl mx-auto p-5" style={{ color: '#17251b' }}>
        <h1 className="text-2xl font-bold">AgroInfo — Informativo Agrícola</h1>
        <p className="my-4" role="status">Não foi possível abrir o painel interativo. Os guias continuam disponíveis nos links abaixo.</p>
        <button type="button" className="underline mb-4" onClick={() => window.location.reload()}>Tentar carregar novamente</button>
        <div dangerouslySetInnerHTML={{ __html: guiasHtml }} />
      </main>
    );
  }
}
