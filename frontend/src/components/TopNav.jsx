import React from 'react';
import { Navbar, Container, Nav } from 'react-bootstrap';

export default function TopNav(){
  return (
    <Navbar bg="dark" variant="dark">
      <Container>
        <Navbar.Brand href="/">Vaquero</Navbar.Brand>
        <Nav className="me-auto">
          <Nav.Link href="/">Dashboard</Nav.Link>
          <Nav.Link href="/products">Productos</Nav.Link>
          <Nav.Link href="/sales">Ventas</Nav.Link>
          <Nav.Link href="/expenses">Gastos</Nav.Link>
        </Nav>
      </Container>
    </Navbar>
  );
}