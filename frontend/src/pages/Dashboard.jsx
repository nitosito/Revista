import React, { useState } from 'react';
import TopNav from '../components/TopNav';
import api from '../services/api';
import { Container, Row, Col, Button, Card } from 'react-bootstrap';

export default function Dashboard() {
  const [start, setStart] = useState('2025-10-01');
  const [end, setEnd] = useState('2025-10-31');

  const downloadXlsx = () => {
    window.location = `/api/reports/monthly/xlsx?start=${start}&end=${end}`;
  };

  const downloadPdf = () => {
    window.location = `/api/reports/monthly/pdf?start=${start}&end=${end}`;
  };

  return (
    <div>
      <TopNav />
      <Container className="mt-4">
        <Row className="mb-3">
          <Col><h2>Dashboard - Vaquero</h2></Col>
          <Col className="text-end">
            <Button variant="success" onClick={downloadXlsx} className="me-2">Exportar XLSX</Button>
            <Button variant="primary" onClick={downloadPdf}>Exportar PDF</Button>
          </Col>
        </Row>

        <Row className="mb-3">
          <Col md={3}><Card className="p-3">App: {process.env.REACT_APP_NAME || 'Vaquero'}</Card></Col>
          <Col md={3}><Card className="p-3">Periodo: <input type="date" value={start} onChange={e=>setStart(e.target.value)} /></Card></Col>
          <Col md={3}><Card className="p-3">Hasta: <input type="date" value={end} onChange={e=>setEnd(e.target.value)} /></Card></Col>
        </Row>

        <Row>
          <Col>
            <Card body>
              <h5>Reportes</h5>
              <p>Pulsa para descargar el informe mensual en XLSX o PDF.</p>
            </Card>
          </Col>
        </Row>

      </Container>
    </div>
  );
}