import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';
import useBaseUrl from '@docusaurus/useBaseUrl';

export default function Api() {
  const url = useBaseUrl('/openapi.json');
  return (
    <Layout title="API reference">
      <BrowserOnly fallback={<div>Loading...</div>}>
        {() => {
          // Swagger UI needs the DOM, so load it only in the browser.
          const SwaggerUI = require('swagger-ui-react').default;
          require('swagger-ui-react/swagger-ui.css');
          // Swagger UI has no dark theme, so keep it on a light panel in both modes.
          return (
            <div style={{ background: '#fff', colorScheme: 'light', minHeight: '100vh' }}>
              <SwaggerUI url={url} />
            </div>
          );
        }}
      </BrowserOnly>
    </Layout>
  );
}
