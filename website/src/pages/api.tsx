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
          return <SwaggerUI url={url} />;
        }}
      </BrowserOnly>
    </Layout>
  );
}
